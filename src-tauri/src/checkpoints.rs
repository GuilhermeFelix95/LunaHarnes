//! Pontos de restauração por turno. Um checkpoint é uma árvore do git gravada com um índice
//! temporário: não cria commit, não mexe no índice nem na branch do usuário.
use std::path::Path;
use std::process::Stdio;

use serde::Serialize;

use crate::changes::is_safe_relative;
use crate::session::{hidden_command, resolve_program};

/// O que mudaria ao voltar a um checkpoint: arquivos criados depois (serão apagados)
/// e arquivos alterados ou removidos depois (serão restaurados).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestorePreview {
    pub removed: Vec<String>,
    pub restored: Vec<String>,
}

fn git(cwd: &Path, args: &[&str], index: Option<&Path>) -> Result<String, String> {
    let program = resolve_program("git").ok_or("git não encontrado no PATH.")?;
    let mut cmd = hidden_command(&program);
    cmd.current_dir(cwd).args(args).stdin(Stdio::null());
    if let Some(index) = index {
        cmd.env("GIT_INDEX_FILE", index);
    }
    let output = cmd
        .output()
        .map_err(|e| format!("não foi possível rodar o git: {e}"))?;
    if !output.status.success() {
        return Err(format!("git falhou: {}", String::from_utf8_lossy(&output.stderr).trim()));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Checkpoint só faz sentido dentro de um repositório git.
fn is_repo(cwd: &Path) -> bool {
    git(cwd, &["rev-parse", "--is-inside-work-tree"], None)
        .map(|out| out.trim() == "true")
        .unwrap_or(false)
}

/// Id de checkpoint: 40 ou 64 dígitos hexadecimais, para nunca virar opção do git.
fn valid_id(id: &str) -> bool {
    matches!(id.len(), 40 | 64) && id.chars().all(|c| c.is_ascii_hexdigit())
}

/// Grava o estado atual dos arquivos como uma árvore e devolve o id. `None` fora de um repositório.
pub fn take(cwd: &Path) -> Result<Option<String>, String> {
    if !is_repo(cwd) {
        return Ok(None);
    }
    let index = std::env::temp_dir().join(format!(
        "luna-checkpoint-index-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    let result = (|| {
        git(cwd, &["add", "-A"], Some(&index))?;
        git(cwd, &["write-tree"], Some(&index))
    })();
    let _ = std::fs::remove_file(&index);
    Ok(Some(result?.trim().to_string()))
}

/// Compara o checkpoint com o estado atual, sem mexer em nada.
fn differences(cwd: &Path, checkpoint: &str) -> Result<RestorePreview, String> {
    if !valid_id(checkpoint) {
        return Err("checkpoint inválido".into());
    }
    let now = take(cwd)?.ok_or("esta pasta não é um repositório git")?;
    let out = git(cwd, &["diff-tree", "-r", "-z", "--name-status", "--no-renames", checkpoint, &now], None)?;
    let mut preview = RestorePreview { removed: Vec::new(), restored: Vec::new() };
    let mut parts = out.split('\0').filter(|p| !p.is_empty());
    while let Some(status) = parts.next() {
        let Some(path) = parts.next() else { break };
        if !is_safe_relative(path) {
            return Err(format!("caminho fora do projeto: `{path}`"));
        }
        // Em `checkpoint → agora`, "A" é arquivo criado depois; "M" e "D" voltam ao que era.
        match status {
            "A" => preview.removed.push(path.to_string()),
            _ => preview.restored.push(path.to_string()),
        }
    }
    Ok(preview)
}

/// Mostra o que mudaria ao voltar ao checkpoint.
pub fn preview(cwd: &Path, checkpoint: &str) -> Result<RestorePreview, String> {
    differences(cwd, checkpoint)
}

/// Volta os arquivos ao estado do checkpoint: apaga os criados depois e restaura os outros.
pub fn restore(cwd: &Path, checkpoint: &str) -> Result<RestorePreview, String> {
    let plan = differences(cwd, checkpoint)?;
    for path in &plan.removed {
        std::fs::remove_file(cwd.join(path))
            .map_err(|e| format!("não foi possível apagar `{path}`: {e}"))?;
    }
    for path in &plan.restored {
        git(cwd, &["restore", "--source", checkpoint, "--worktree", "--", path], None)?;
    }
    Ok(plan)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn repo(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("lunaharness-checkpoint-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let run = |args: &[&str]| {
            let ok = std::process::Command::new("git")
                .args(args)
                .current_dir(&dir)
                .output()
                .expect("git precisa estar no PATH para este teste")
                .status
                .success();
            assert!(ok, "git {args:?} falhou");
        };
        run(&["init", "-q"]);
        run(&["config", "user.email", "teste@luna.local"]);
        run(&["config", "user.name", "Teste"]);
        std::fs::write(dir.join("a.txt"), "um\n").unwrap();
        run(&["add", "-A"]);
        run(&["commit", "-q", "-m", "base"]);
        dir
    }

    /// Voltar ao checkpoint restaura o alterado, apaga o criado depois e não cria commit.
    #[test]
    fn restore_brings_back_the_checkpoint_state_without_committing() {
        let dir = repo("restore");
        let head_before = git(&dir, &["rev-parse", "HEAD"], None).unwrap();
        let cp = take(&dir).unwrap().expect("é um repositório");

        std::fs::write(dir.join("a.txt"), "mudou\n").unwrap();
        std::fs::write(dir.join("novo.txt"), "novo\n").unwrap();
        let plan = preview(&dir, &cp).unwrap();
        assert_eq!(plan.removed, vec!["novo.txt".to_string()]);
        assert_eq!(plan.restored, vec!["a.txt".to_string()]);

        restore(&dir, &cp).unwrap();
        assert_eq!(std::fs::read_to_string(dir.join("a.txt")).unwrap().replace("\r\n", "\n"), "um\n");
        assert!(!dir.join("novo.txt").exists());
        assert_eq!(git(&dir, &["rev-parse", "HEAD"], None).unwrap(), head_before);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn checkpoint_ids_must_be_hex_digests() {
        assert!(!valid_id("--help"));
        assert!(!valid_id(""));
        assert!(valid_id(&"a".repeat(40)));
    }

    #[test]
    fn folder_without_git_has_no_checkpoint() {
        let dir = std::env::temp_dir().join(format!("lunaharness-checkpoint-nogit-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        assert_eq!(take(&dir).unwrap(), None);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
