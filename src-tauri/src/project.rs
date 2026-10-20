//! Arquivos do projeto que as CLIs de código leem. Só confere se existem: não cria, não lê e não altera nada.
use std::path::Path;

use serde::Serialize;

/// O que cada arquivo ou pasta faz para o agente. Mesma ideia do `/init` das CLIs: instruções do projeto.
const CHECKS: [(&str, &str); 5] = [
    ("CLAUDE.md", "instruções lidas pelo Claude Code"),
    ("AGENTS.md", "instruções lidas pelo Codex e outras CLIs"),
    (".claude", "configurações, comandos e skills do Claude Code"),
    (".mcp.json", "servidores MCP deste projeto"),
    (".git", "repositório git (alterações e checkpoints)"),
];

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFile {
    pub name: String,
    pub found: bool,
    pub purpose: String,
}

/// Situação de cada item da lista dentro da pasta do projeto.
pub fn check(root: &Path) -> Vec<ProjectFile> {
    CHECKS
        .iter()
        .map(|(name, purpose)| ProjectFile {
            name: name.to_string(),
            found: root.join(name).exists(),
            purpose: purpose.to_string(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = env::temp_dir().join(format!("lunaharness-project-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn found(files: &[ProjectFile], name: &str) -> bool {
        files.iter().find(|f| f.name == name).map(|f| f.found).unwrap()
    }

    #[test]
    fn reports_which_harness_files_exist_in_the_project() {
        let dir = temp_dir("mixed");
        fs::write(dir.join("CLAUDE.md"), "# regras").unwrap();
        fs::create_dir_all(dir.join(".claude")).unwrap();

        let files = check(&dir);

        assert_eq!(files.len(), 5);
        assert!(found(&files, "CLAUDE.md"));
        assert!(found(&files, ".claude"));
        assert!(!found(&files, "AGENTS.md"));
        assert!(!found(&files, ".mcp.json"));
        assert!(!found(&files, ".git"));
    }

    #[test]
    fn an_empty_folder_has_none_of_them_and_nothing_is_created() {
        let dir = temp_dir("empty");

        let files = check(&dir);

        assert!(files.iter().all(|f| !f.found));
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 0);
    }
}
