//! Prévia do clone no navegador embutido. A pasta do clone (dentro do projeto) é servida em 127.0.0.1, só para
//! leitura e só com tipos de página, estilo, imagem e fonte. Nada fora dessa pasta é entregue, e pastas ocultas
//! também não. A aba do navegador abre o endereço como numa navegação comum.
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

/// Pasta do clone que o servidor entrega agora. Trocar de clone troca a pasta servida.
static ROOT: Mutex<Option<PathBuf>> = Mutex::new(None);
/// Porta do servidor, quando já subiu (uma vez por execução do app).
static PORT: OnceLock<u16> = OnceLock::new();
/// Arquivo maior que isso não é entregue (o clone é de páginas, não de vídeo).
const MAX_FILE: u64 = 50 * 1024 * 1024;
/// Linhas de cabeçalho lidas no máximo. Passou disso, a requisição é recusada.
const MAX_HEADER_LINES: usize = 100;

/// Pasta do clone dentro do projeto. O nome não pode trazer separador, drive, ponto no começo nem caractere
/// reservado; a pasta precisa existir.
pub fn folder_dir(cwd: &Path, folder: &str) -> Result<PathBuf, String> {
    let reserved = folder.chars().any(|c| matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') || c.is_control());
    if folder.trim().is_empty() || folder.len() > 80 || folder.starts_with('.') || reserved {
        return Err("nome de pasta inválido para a prévia".into());
    }
    let dir = cwd.join(folder);
    if !dir.is_dir() {
        return Err(format!("a pasta {folder} não existe no projeto"));
    }
    dir.canonicalize().map_err(|e| format!("não foi possível abrir a pasta {folder}: {e}"))
}

/// Tipos que o servidor entrega. Qualquer outro caminho responde 404.
pub fn content_type(path: &Path) -> Option<&'static str> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    Some(match ext.as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "txt" => "text/plain; charset=utf-8",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        _ => return None,
    })
}

/// Decodifica %XX do caminho pedido pelo navegador (espaços chegam como %20). Sequência inválida recusa o pedido.
fn percent_decode(raw: &str) -> Option<String> {
    let bytes = raw.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = raw.get(i + 1..i + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// Arquivo que a requisição pede dentro de `root`, se ele existir e for de um tipo servido.
/// `root` precisa ser o caminho canônico da pasta do clone. Sem query, sem `..`, sem pasta oculta, sem saída da pasta.
pub fn resolve(root: &Path, request_target: &str) -> Option<PathBuf> {
    let path = request_target.split(['?', '#']).next().unwrap_or_default();
    let decoded = percent_decode(path)?;
    if decoded.contains('\0') || decoded.contains('\\') {
        return None;
    }
    let trimmed = decoded.trim_start_matches('/');
    let rel = if trimmed.is_empty() || trimmed.ends_with('/') { format!("{trimmed}index.html") } else { trimmed.to_string() };
    if rel.split('/').any(|segment| segment.is_empty() || segment.starts_with('.')) {
        return None;
    }
    let candidate = root.join(&rel).canonicalize().ok()?;
    if !candidate.starts_with(root) || !candidate.is_file() {
        return None;
    }
    content_type(&candidate)?;
    Some(candidate)
}

/// Endereço da prévia da pasta do clone. Sobe o servidor na primeira vez e troca a pasta servida.
pub fn preview_url(cwd: &Path, folder: &str) -> Result<String, String> {
    let dir = folder_dir(cwd, folder)?;
    if !dir.join("index.html").is_file() {
        return Err("ainda não há index.html nesta pasta. Quando o agente terminar o clone, abra a prévia de novo.".into());
    }
    *ROOT.lock().map_err(|_| "estado da prévia travado".to_string())? = Some(dir);
    let port = match PORT.get() {
        Some(port) => *port,
        None => {
            let port = start()?;
            let _ = PORT.set(port);
            port
        }
    };
    Ok(format!("http://127.0.0.1:{port}/index.html"))
}

/// Comando do front: endereço da prévia de uma subpasta do projeto.
#[tauri::command]
pub fn browser_preview_url(cwd: String, folder: String) -> Result<String, String> {
    preview_url(Path::new(&cwd), &folder)
}

fn start() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("não foi possível abrir a porta da prévia: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            std::thread::spawn(move || handle(stream));
        }
    });
    Ok(port)
}

fn handle(stream: TcpStream) {
    let mut reader = BufReader::new(match stream.try_clone() {
        Ok(clone) => clone,
        Err(_) => return,
    });
    let mut writer = stream;
    let mut request_line = String::new();
    if reader.read_line(&mut request_line).is_err() {
        return;
    }
    for _ in 0..MAX_HEADER_LINES {
        let mut header = String::new();
        match reader.read_line(&mut header) {
            Ok(0) | Err(_) => break,
            Ok(_) if header.trim().is_empty() => break,
            Ok(_) => {}
        }
    }
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or_default();
    let target = parts.next().unwrap_or_default();
    let (status, content_type, body) = if method != "GET" {
        (405, "text/plain; charset=utf-8", b"metodo nao permitido".to_vec())
    } else {
        match serve(target) {
            Some((ctype, bytes)) => (200, ctype, bytes),
            None => (404, "text/plain; charset=utf-8", b"nao encontrado".to_vec()),
        }
    };
    let reason = match status {
        200 => "OK",
        405 => "Method Not Allowed",
        _ => "Not Found",
    };
    let head = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = writer.write_all(head.as_bytes());
    let _ = writer.write_all(&body);
}

fn serve(target: &str) -> Option<(&'static str, Vec<u8>)> {
    let root = ROOT.lock().ok()?.clone()?;
    let file = resolve(&root, target)?;
    if fs::metadata(&file).ok()?.len() > MAX_FILE {
        return None;
    }
    let ctype = content_type(&file)?;
    Some((ctype, fs::read(&file).ok()?))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Pasta temporária com um clone de teste: index, uma imagem, um arquivo de fora e um oculto.
    fn clone_dir(name: &str) -> (PathBuf, PathBuf) {
        let base = std::env::temp_dir().join(format!("lunaharness-preview-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let project = base.join("projeto");
        let clone = project.join("Loja Nova");
        fs::create_dir_all(clone.join("img")).unwrap();
        fs::write(clone.join("index.html"), "<h1>Loja</h1>").unwrap();
        fs::write(clone.join("img").join("logo.png"), [0x89, b'P', b'N', b'G']).unwrap();
        fs::write(clone.join(".env"), "SEGREDO=1").unwrap();
        fs::write(project.join("segredo.txt"), "fora do clone").unwrap();
        (base, clone.canonicalize().unwrap())
    }

    #[test]
    fn serves_the_index_for_the_root_and_for_folders() {
        let (base, clone) = clone_dir("index");
        assert_eq!(resolve(&clone, "/"), Some(clone.join("index.html")));
        assert_eq!(resolve(&clone, "/index.html?v=2#topo"), Some(clone.join("index.html")));
        let _ = fs::remove_dir_all(base);
    }

    #[test]
    fn spaces_arrive_encoded_and_still_find_the_file() {
        let (base, clone) = clone_dir("encoded");
        assert_eq!(resolve(&clone, "/img/logo.png"), Some(clone.join("img").join("logo.png")));
        assert!(resolve(&clone, "/img/%6Co%67o.png").is_some());
        let _ = fs::remove_dir_all(base);
    }

    #[test]
    fn nothing_outside_the_clone_is_served() {
        let (base, clone) = clone_dir("escape");
        assert!(resolve(&clone, "/../segredo.txt").is_none());
        assert!(resolve(&clone, "/%2e%2e/segredo.txt").is_none());
        assert!(resolve(&clone, "/..%2fsegredo.txt").is_none());
        assert!(resolve(&clone, "/img/../../segredo.txt").is_none());
        assert!(resolve(&clone, "/%5c..%5csegredo.txt").is_none());
        let _ = fs::remove_dir_all(base);
    }

    #[test]
    fn hidden_files_and_unknown_types_are_not_served() {
        let (base, clone) = clone_dir("hidden");
        assert!(resolve(&clone, "/.env").is_none());
        fs::write(clone.join("script.exe"), "x").unwrap();
        assert!(resolve(&clone, "/script.exe").is_none());
        assert!(resolve(&clone, "/%ZZ").is_none(), "escape inválido recusa o pedido");
        let _ = fs::remove_dir_all(base);
    }

    #[test]
    fn folder_names_that_could_leave_the_project_are_refused() {
        let cwd = std::env::temp_dir();
        for bad in ["", "..", "../x", "a/b", "a\\b", "C:x", ".oculta", "a*b"] {
            assert!(folder_dir(&cwd, bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn only_the_known_page_style_image_and_font_types_are_served() {
        assert_eq!(content_type(Path::new("a.html")), Some("text/html; charset=utf-8"));
        assert_eq!(content_type(Path::new("a.CSS")), Some("text/css; charset=utf-8"));
        assert_eq!(content_type(Path::new("a.woff2")), Some("font/woff2"));
        assert_eq!(content_type(Path::new("a.exe")), None);
        assert_eq!(content_type(Path::new("sem-extensao")), None);
    }

    #[test]
    fn a_folder_without_index_gets_a_clear_message() {
        let (base, _clone) = clone_dir("noindex");
        let project = base.join("projeto");
        fs::create_dir_all(project.join("Vazia")).unwrap();
        let err = preview_url(&project, "Vazia").unwrap_err();
        assert!(err.contains("index.html"), "{err}");
        let _ = fs::remove_dir_all(base);
    }
}
