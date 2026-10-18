//! Especificação técnica do projeto: os arquivos `.md` de `<projeto>/spec/`.
//! O harness lê essa pasta em toda chamada e põe o texto no prompt, antes do pedido.

use std::fs;
use std::path::Path;

/// Pasta da spec, dentro do projeto. Fixa: nunca vem do usuário, então não há travessia de caminho.
const SPEC_DIR: &str = "spec";
/// Limite do texto injetado por chamada, para a spec não tomar a janela de contexto.
const MAX_BYTES: usize = 64 * 1024;

/// Texto de todos os `.md` de `<cwd>/spec/`, em ordem de nome, cada um com um título.
/// Sem pasta ou sem arquivos, devolve vazio.
pub fn load_spec(cwd: &Path) -> Result<String, String> {
    let dir = cwd.join(SPEC_DIR);
    if !dir.is_dir() {
        return Ok(String::new());
    }
    let mut names: Vec<_> = fs::read_dir(&dir)
        .map_err(|e| format!("não foi possível ler a pasta spec: {e}"))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_file() && path.extension().is_some_and(|ext| ext == "md"))
        .collect();
    names.sort();

    let mut text = String::new();
    for path in names {
        let body = fs::read_to_string(&path).map_err(|e| format!("não foi possível ler {}: {e}", path.display()))?;
        let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        text.push_str(&format!("## {name}\n{}\n\n", body.trim()));
    }
    Ok(truncate(text))
}

fn truncate(text: String) -> String {
    if text.len() <= MAX_BYTES {
        return text;
    }
    let mut end = MAX_BYTES;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}\n\n[spec cortada: passou de {} KB]", &text[..end], MAX_BYTES / 1024)
}

/// Prompt final: a spec vem antes do pedido, com a ordem de seguir sem desviar.
pub fn with_spec(spec: &str, prompt: &str) -> String {
    if spec.is_empty() {
        return prompt.to_string();
    }
    format!("Especificação do projeto (obrigatória, siga sem desviar):\n\n{spec}\n---\n\n{prompt}")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("lunaharness-spec-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn no_spec_folder_means_no_text() {
        let dir = temp("none");
        assert_eq!(load_spec(&dir).unwrap(), "");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn reads_only_markdown_files_in_name_order() {
        let dir = temp("order");
        fs::create_dir_all(dir.join("spec")).unwrap();
        fs::write(dir.join("spec").join("stack.md"), "Frontend React.").unwrap();
        fs::write(dir.join("spec").join("api.md"), "Sem backend próprio.").unwrap();
        fs::write(dir.join("spec").join("notas.txt"), "ignorar").unwrap();

        let text = load_spec(&dir).unwrap();

        assert!(text.find("## api.md").unwrap() < text.find("## stack.md").unwrap());
        assert!(text.contains("Frontend React."));
        assert!(!text.contains("ignorar"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn long_spec_is_cut_at_the_limit_on_a_char_boundary() {
        let long = "á".repeat(MAX_BYTES);
        let cut = truncate(long);

        assert!(cut.len() <= MAX_BYTES + 100);
        assert!(cut.ends_with("KB]"));
    }

    #[test]
    fn prompt_gets_the_spec_before_the_request() {
        let prompt = with_spec("## stack.md\nReact", "crie a tela");

        assert!(prompt.starts_with("Especificação do projeto"));
        assert!(prompt.ends_with("crie a tela"));
        assert_eq!(with_spec("", "oi"), "oi");
    }
}
