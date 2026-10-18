//! Branches e worktrees: a conversa pode trabalhar numa branch sem mexer na pasta principal do projeto.
//! A worktree fica numa pasta irmã do repositório, com o nome da branch no fim.
use std::path::{Path, PathBuf};

use crate::changes::run_git;

/// Nome de branch que o git aceita e que não tem nada que o shell possa interpretar.
pub fn is_valid_branch(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 120
        && !name.starts_with('-')
        && !name.ends_with('/')
        && !name.contains("..")
        && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | '/'))
}

/// Pasta da worktree: ao lado do repositório, com a branch no nome (barras viram traço).
pub fn worktree_path(repo: &Path, branch: &str) -> PathBuf {
    let name = repo.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "projeto".into());
    let slug = branch.replace('/', "-");
    repo.parent().unwrap_or(repo).join(format!("{name}-{slug}"))
}

/// Branches locais do repositório, em ordem alfabética.
pub fn list_branches(repo: &Path) -> Result<Vec<String>, String> {
    let out = run_git(repo, &["branch", "--format=%(refname:short)"])?.unwrap_or_default();
    let mut names: Vec<String> = out.lines().map(str::trim).filter(|l| !l.is_empty()).map(String::from).collect();
    names.sort();
    Ok(names)
}

/// Cria a worktree numa branch existente, ou numa branch nova a partir da atual.
pub fn create_worktree(repo: &Path, branch: &str, new_branch: bool) -> Result<PathBuf, String> {
    if !is_valid_branch(branch) {
        return Err(format!("Nome de branch inválido: \"{branch}\"."));
    }
    let path = worktree_path(repo, branch);
    if path.exists() {
        return Err(format!("A pasta {} já existe.", path.display()));
    }
    let target = path.to_string_lossy().into_owned();
    let args: Vec<&str> = if new_branch {
        vec!["worktree", "add", "-b", branch, &target]
    } else {
        vec!["worktree", "add", &target, branch]
    };
    run_git(repo, &args).map_err(|e| format!("Não foi possível criar a worktree: {e}"))?;
    Ok(path)
}

#[tauri::command]
pub fn list_git_branches(cwd: String) -> Result<Vec<String>, String> {
    list_branches(Path::new(&cwd))
}

#[tauri::command]
pub fn create_git_worktree(cwd: String, branch: String, new_branch: bool) -> Result<String, String> {
    create_worktree(Path::new(&cwd), &branch, new_branch).map(|p| p.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_branch_names_that_git_or_the_shell_would_not_take() {
        assert!(is_valid_branch("feature/login-2"));
        assert!(!is_valid_branch(""));
        assert!(!is_valid_branch("-f"));
        assert!(!is_valid_branch("a b"));
        assert!(!is_valid_branch("a;rm -rf"));
        assert!(!is_valid_branch("../x"));
        assert!(!is_valid_branch("x/"));
    }

    #[test]
    fn worktree_folder_sits_next_to_the_repo_with_the_branch_in_its_name() {
        let path = worktree_path(Path::new("C:/dev/app"), "feature/login");
        assert_eq!(path, Path::new("C:/dev/app-feature-login"));
    }

    /// Repositório real com uma branch extra: a worktree aparece numa pasta irmã e a branch fica checada.
    #[test]
    fn creates_a_worktree_on_an_existing_branch() {
        let base = std::env::temp_dir().join(format!("lunaharness-wt-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        let repo = base.join("app");
        std::fs::create_dir_all(&repo).unwrap();
        let git = |args: &[&str]| {
            std::process::Command::new("git")
                .args(args)
                .current_dir(&repo)
                .output()
                .expect("git precisa estar no PATH para este teste")
        };
        git(&["init", "-q"]);
        git(&["config", "user.email", "t@t.dev"]);
        git(&["config", "user.name", "t"]);
        std::fs::write(repo.join("a.txt"), "x").unwrap();
        git(&["add", "."]);
        git(&["commit", "-q", "-m", "inicial"]);
        git(&["branch", "feature/teste"]);

        assert!(list_branches(&repo).unwrap().contains(&"feature/teste".to_string()));

        let created = create_worktree(&repo, "feature/teste", false).unwrap();
        assert!(created.join("a.txt").exists());
        let head = std::process::Command::new("git")
            .args(["rev-parse", "--abbrev-ref", "HEAD"])
            .current_dir(&created)
            .output()
            .unwrap();
        assert_eq!(String::from_utf8_lossy(&head.stdout).trim(), "feature/teste");

        let _ = std::process::Command::new("git").args(["worktree", "remove", "--force", &created.to_string_lossy()]).current_dir(&repo).output();
        let _ = std::fs::remove_dir_all(&base);
        let _ = std::fs::remove_dir_all(&created);
    }
}
