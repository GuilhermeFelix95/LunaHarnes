//! Especificação técnica do projeto: os arquivos `.md` de `<projeto>/spec/`.
//! O harness lê essa pasta em toda chamada e põe o texto no prompt, antes do pedido.

use std::fs;
use std::path::Path;

/// Pasta da spec, dentro do projeto. Fixa: nunca vem do usuário, então não há travessia de caminho.
const SPEC_DIR: &str = "spec";
/// Limite do texto injetado por chamada, para a spec não tomar a janela de contexto.
const MAX_BYTES: usize = 64 * 1024;
/// Specs de cada conversa, uma pasta por spec (formato do spec-kit).
const SPECS_DIR: &str = "specs";
const DECISIONS_FILE: &str = "decisions.md";

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

/// Pasta de uma spec por conversa, no formato do spec-kit: `specs/NNN-slug/`. NNN é sequencial dentro do projeto.
/// Cria a pasta e devolve o caminho relativo ao projeto.
pub fn new_spec_dir(cwd: &Path, title: &str) -> Result<String, String> {
    let root = cwd.join(SPECS_DIR);
    fs::create_dir_all(&root).map_err(|e| format!("não foi possível criar a pasta specs: {e}"))?;
    let next = fs::read_dir(&root)
        .map_err(|e| format!("não foi possível ler a pasta specs: {e}"))?
        .filter_map(Result::ok)
        .filter_map(|entry| entry.file_name().to_string_lossy().get(..3).and_then(|n| n.parse::<u32>().ok()))
        .max()
        .unwrap_or(0)
        + 1;
    let name = format!("{next:03}-{}", slug(title));
    fs::create_dir_all(root.join(&name)).map_err(|e| format!("não foi possível criar a spec {name}: {e}"))?;
    Ok(format!("{SPECS_DIR}/{name}"))
}

/// Parte do título que vira nome de pasta: minúsculas, sem acento, separada por hífen, até 40 caracteres.
fn slug(title: &str) -> String {
    let mut out = String::new();
    for c in title.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
        } else if !out.ends_with('-') && !out.is_empty() {
            out.push('-');
        }
        if out.len() >= 40 {
            break;
        }
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() { "spec".into() } else { trimmed }
}

/// Só aceita `specs/<pasta>` que já existe dentro do projeto. Qualquer outro caminho é recusado.
fn checked_spec_dir(cwd: &Path, spec_dir: &str) -> Result<std::path::PathBuf, String> {
    let prefix = format!("{SPECS_DIR}/");
    let rest = spec_dir.strip_prefix(prefix.as_str()).ok_or_else(|| format!("pasta de spec inválida: `{spec_dir}`"))?;
    if rest.is_empty() || rest.contains(['/', '\\']) || !crate::changes::is_safe_relative(spec_dir) {
        return Err(format!("pasta de spec inválida: `{spec_dir}`"));
    }
    let dir = cwd.join(spec_dir);
    if !dir.is_dir() {
        return Err(format!("a pasta da spec não existe: `{spec_dir}`"));
    }
    Ok(dir)
}

/// Grava uma rodada de perguntas em `decisions.md` da spec. Cada linha é "pergunta: resposta", como o seletor mostra.
/// O número da rodada sai do próprio arquivo, então continua certo quando a conversa é reaberta.
pub fn record_decisions(cwd: &Path, spec_dir: &str, lines: &[String]) -> Result<(), String> {
    let dir = checked_spec_dir(cwd, spec_dir)?;
    let path = dir.join(DECISIONS_FILE);
    let mut text = if path.exists() {
        fs::read_to_string(&path).map_err(|e| format!("não foi possível ler as decisões: {e}"))?
    } else {
        "# Decisões\n".to_string()
    };
    let round = text.matches("\n## Rodada ").count() + 1;
    text.push_str(&format!("\n## Rodada {round}\n"));
    for line in lines.iter().map(|l| l.trim()).filter(|l| !l.is_empty()) {
        let short: String = line.chars().take(500).collect();
        text.push_str(&format!("- {short}\n"));
    }
    fs::write(&path, text).map_err(|e| format!("não foi possível gravar as decisões: {e}"))
}

/// Spec da conversa (spec.md) mais as decisões (decisions.md), para o prompt de cada turno.
pub fn load_conversation_spec(cwd: &Path, spec_dir: &str) -> Result<String, String> {
    let dir = checked_spec_dir(cwd, spec_dir)?;
    let mut text = String::new();
    for name in ["spec.md", DECISIONS_FILE] {
        let path = dir.join(name);
        if let Ok(body) = fs::read_to_string(&path) {
            text.push_str(&format!("## {name}\n{}\n\n", body.trim()));
        }
    }
    Ok(truncate(text))
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

    #[test]
    fn new_spec_dir_numbers_the_folders_and_slugs_the_title() {
        let dir = temp("numbering");

        assert_eq!(new_spec_dir(&dir, "Cache de Prompt!").unwrap(), "specs/001-cache-de-prompt");
        assert_eq!(new_spec_dir(&dir, "").unwrap(), "specs/002-spec");
        assert!(dir.join("specs/002-spec").is_dir());
    }

    #[test]
    fn decisions_are_appended_per_round_and_loaded_with_the_spec() {
        let dir = temp("decisions");
        let spec = new_spec_dir(&dir, "tela").unwrap();
        fs::write(dir.join(&spec).join("spec.md"), "# tela

Decidido: React.").unwrap();

        record_decisions(&dir, &spec, &["Qual cor?: azul".into()]).unwrap();
        record_decisions(&dir, &spec, &["Modo?: escuro".into(), "  ".into()]).unwrap();
        let loaded = load_conversation_spec(&dir, &spec).unwrap();

        assert!(loaded.contains("Decidido: React."));
        assert!(loaded.contains("## Rodada 1
- Qual cor?: azul"));
        assert!(loaded.contains("## Rodada 2
- Modo?: escuro"));
    }

    #[test]
    fn only_existing_spec_folders_inside_specs_are_accepted() {
        let dir = temp("paths");
        let spec = new_spec_dir(&dir, "x").unwrap();

        assert!(record_decisions(&dir, "../fora", &[]).is_err());
        assert!(record_decisions(&dir, "specs/../x", &[]).is_err());
        assert!(record_decisions(&dir, &format!("{spec}/extra"), &[]).is_err());
        assert!(record_decisions(&dir, "specs/999-nao-existe", &[]).is_err());
        assert!(load_conversation_spec(&dir, "/etc").is_err());
    }
}
