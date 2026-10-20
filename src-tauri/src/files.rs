//! Navegação somente leitura pelos arquivos do projeto: lista uma pasta por vez e lê arquivos de texto pequenos.
//! Tudo fica dentro da pasta do projeto (caminho relativo, sem `..`, sem sair por link simbólico).
use std::fs;
use std::path::Path;

use serde::Serialize;

use crate::changes::is_safe_relative;

/// Arquivo maior que isso não é aberto no visualizador.
const MAX_READ_BYTES: u64 = 512_000;
/// Pasta com mais itens que isso é cortada: uma pasta de dependências não deve travar o painel.
const MAX_ENTRIES: usize = 2_000;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    /// Caminho relativo à pasta do projeto, com `/`.
    pub path: String,
    pub is_dir: bool,
}

/// Caminho relativo da pasta do projeto, com `/`. Vazio = a própria pasta do projeto.
fn resolve(root: &Path, rel: &str) -> Result<std::path::PathBuf, String> {
    if rel.is_empty() {
        return Ok(root.to_path_buf());
    }
    if !is_safe_relative(rel) {
        return Err(format!("caminho fora do projeto: `{rel}`"));
    }
    let full = root.join(rel);
    // Um link simbólico dentro do projeto não pode levar para fora dele.
    let real_root = root.canonicalize().map_err(|e| format!("não foi possível abrir o projeto: {e}"))?;
    let real = full.canonicalize().map_err(|e| format!("não encontrado: `{rel}` ({e})"))?;
    if !real.starts_with(&real_root) {
        return Err(format!("caminho fora do projeto: `{rel}`"));
    }
    Ok(real)
}

/// Itens de uma pasta: pastas primeiro, depois arquivos, em ordem alfabética. `.git` fica de fora.
pub fn list_dir(root: &Path, rel: &str) -> Result<Vec<Entry>, String> {
    let dir = resolve(root, rel)?;
    if !dir.is_dir() {
        return Err(format!("não é uma pasta: `{rel}`"));
    }
    let read = fs::read_dir(&dir).map_err(|e| format!("não foi possível ler a pasta `{rel}`: {e}"))?;
    let mut entries: Vec<Entry> = read
        .flatten()
        .filter_map(|item| {
            let name = item.file_name().to_string_lossy().to_string();
            if name == ".git" {
                return None;
            }
            let is_dir = item.file_type().map(|t| t.is_dir()).unwrap_or(false);
            let path = if rel.is_empty() { name.clone() } else { format!("{rel}/{name}") };
            Some(Entry { name, path, is_dir })
        })
        .collect();
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    entries.truncate(MAX_ENTRIES);
    Ok(entries)
}

/// Conteúdo de um arquivo de texto. Binário, grande demais ou fora de UTF-8 não é aberto.
pub fn read_text(root: &Path, rel: &str) -> Result<String, String> {
    let file = resolve(root, rel)?;
    let meta = fs::metadata(&file).map_err(|e| format!("não foi possível abrir `{rel}`: {e}"))?;
    if !meta.is_file() {
        return Err(format!("não é um arquivo: `{rel}`"));
    }
    if meta.len() > MAX_READ_BYTES {
        return Err(format!("`{rel}` é grande demais para abrir aqui ({} KB)", meta.len() / 1024));
    }
    let bytes = fs::read(&file).map_err(|e| format!("não foi possível ler `{rel}`: {e}"))?;
    if bytes.contains(&0) {
        return Err(format!("`{rel}` parece binário, não dá para mostrar como texto"));
    }
    String::from_utf8(bytes).map_err(|_| format!("`{rel}` não está em UTF-8, não dá para mostrar como texto"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn project(name: &str) -> std::path::PathBuf {
        let dir = env::temp_dir().join(format!("lunaharness-files-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("src")).unwrap();
        fs::create_dir_all(dir.join(".git")).unwrap();
        fs::write(dir.join("README.md"), "# oi").unwrap();
        fs::write(dir.join("src").join("main.rs"), "fn main() {}").unwrap();
        dir
    }

    #[test]
    fn lists_folders_first_and_hides_git() {
        let dir = project("list");

        let names: Vec<String> = list_dir(&dir, "").unwrap().into_iter().map(|e| e.name).collect();

        assert_eq!(names, vec!["src", "README.md"]);
    }

    #[test]
    fn lists_a_subfolder_with_full_relative_paths() {
        let dir = project("sub");

        let entries = list_dir(&dir, "src").unwrap();

        assert_eq!(entries[0].path, "src/main.rs");
        assert!(!entries[0].is_dir);
    }

    #[test]
    fn reads_a_text_file_inside_the_project() {
        let dir = project("read");

        assert_eq!(read_text(&dir, "src/main.rs").unwrap(), "fn main() {}");
    }

    #[test]
    fn refuses_paths_that_leave_the_project() {
        let dir = project("escape");

        assert!(list_dir(&dir, "../").is_err());
        assert!(read_text(&dir, "../secreto.txt").is_err());
        assert!(read_text(&dir, "/etc/passwd").is_err());
    }

    #[test]
    fn refuses_binary_and_large_files() {
        let dir = project("binary");
        fs::write(dir.join("logo.bin"), [0u8, 159, 146, 150]).unwrap();
        fs::write(dir.join("grande.txt"), vec![b'a'; (MAX_READ_BYTES + 1) as usize]).unwrap();

        assert!(read_text(&dir, "logo.bin").unwrap_err().contains("binário"));
        assert!(read_text(&dir, "grande.txt").unwrap_err().contains("grande demais"));
    }
}
