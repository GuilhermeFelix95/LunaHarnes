//! Arquivos alterados na pasta de trabalho, lidos do git (`status` e `diff`).
//! Fora de um repositório git o módulo não inventa lista: devolve `is_repo: false`.
use std::collections::HashMap;
use std::path::{Component, Path};
use std::process::Stdio;

use serde::Serialize;

use crate::session::{hidden_command, resolve_program};

/// Árvore vazia do git: base de comparação quando o repositório ainda não tem commit.
const EMPTY_TREE: &str = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
/// Limite para mostrar o conteúdo de um arquivo novo, em bytes.
const MAX_NEW_FILE_BYTES: u64 = 200_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFile {
    pub path: String,
    /// `added`, `modified`, `deleted`, `renamed` ou `untracked`.
    pub status: String,
    /// `None` para arquivo binário ou arquivo novo sem commit.
    pub additions: Option<u32>,
    pub deletions: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Changes {
    pub is_repo: bool,
    pub files: Vec<ChangedFile>,
}

/// Lê `git status --porcelain=v1 -z`. Cada entrada é `XY caminho`; renomeações trazem o caminho antigo depois.
pub fn parse_status(output: &str) -> Vec<(String, String)> {
    let mut entries = output.split('\0').filter(|e| !e.is_empty());
    let mut files = Vec::new();

    while let Some(entry) = entries.next() {
        if entry.len() < 4 {
            continue;
        }
        let (code, path) = (&entry[..2], &entry[3..]);
        let status = match code {
            "??" => "untracked",
            _ if code.contains('R') || code.contains('C') => {
                // O próximo item é o caminho antigo; quem interessa é o novo.
                entries.next();
                "renamed"
            }
            _ if code.contains('D') => "deleted",
            _ if code.contains('A') => "added",
            _ => "modified",
        };
        files.push((status.to_string(), path.to_string()));
    }
    files
}

/// Lê `git diff --numstat -z`: `adicionadas\tremovidas\tcaminho\0`. Binários vêm com `-`.
pub fn parse_numstat(output: &str) -> HashMap<String, (Option<u32>, Option<u32>)> {
    let mut stats = HashMap::new();
    let mut parts = output.split('\0').filter(|p| !p.is_empty());

    while let Some(entry) = parts.next() {
        let mut cells = entry.splitn(3, '\t');
        let (added, removed, path) = (cells.next(), cells.next(), cells.next());
        let (Some(added), Some(removed)) = (added, removed) else { continue };
        // Renomeação: o caminho vem vazio e o novo caminho é o segundo item depois do antigo.
        let path = match path {
            Some(p) if !p.is_empty() => p.to_string(),
            _ => {
                parts.next();
                match parts.next() {
                    Some(new) => new.to_string(),
                    None => continue,
                }
            }
        };
        let number = |cell: &str| cell.parse::<u32>().ok();
        stats.insert(path, (number(added), number(removed)));
    }
    stats
}

/// Caminho relativo e sem `..`, para que o diff nunca saia da pasta do projeto.
pub fn is_safe_relative(path: &str) -> bool {
    let p = Path::new(path);
    !path.is_empty()
        && !p.is_absolute()
        && p.components().all(|c| matches!(c, Component::Normal(_)))
}

fn git(cwd: &Path) -> Result<std::process::Command, String> {
    let program = resolve_program("git").ok_or("git não encontrado no PATH.")?;
    let mut cmd = hidden_command(&program);
    cmd.current_dir(cwd).stdin(Stdio::null());
    Ok(cmd)
}

pub(crate) fn run_git(cwd: &Path, args: &[&str]) -> Result<Option<String>, String> {
    let output = git(cwd)?
        .args(args)
        .output()
        .map_err(|e| format!("não foi possível rodar o git: {e}"))?;
    if output.status.success() {
        Ok(Some(String::from_utf8_lossy(&output.stdout).into_owned()))
    } else {
        Ok(None)
    }
}

/// Base de comparação: o último commit, ou a árvore vazia se o repositório ainda não tem commit.
fn base(cwd: &Path) -> Result<String, String> {
    Ok(match run_git(cwd, &["rev-parse", "--verify", "-q", "HEAD"])? {
        Some(_) => "HEAD".into(),
        None => EMPTY_TREE.into(),
    })
}

/// Lista os arquivos alterados em `cwd`. Pasta sem git volta com `is_repo: false`.
pub fn collect(cwd: &Path) -> Result<Changes, String> {
    let inside = run_git(cwd, &["rev-parse", "--is-inside-work-tree"])?;
    if inside.as_deref().map(str::trim) != Some("true") {
        return Ok(Changes { is_repo: false, files: Vec::new() });
    }

    let status = run_git(cwd, &["status", "--porcelain=v1", "-z", "--untracked-files=all"])?
        .ok_or("git status falhou nesta pasta")?;
    let base = base(cwd)?;
    let numstat = run_git(cwd, &["diff", "--numstat", "-z", &base])?.unwrap_or_default();
    let stats = parse_numstat(&numstat);

    let files = parse_status(&status)
        .into_iter()
        .map(|(status, path)| {
            let (additions, deletions) = stats.get(&path).copied().unwrap_or((None, None));
            ChangedFile { path, status, additions, deletions }
        })
        .collect();
    Ok(Changes { is_repo: true, files })
}

/// Diff de um arquivo. Arquivo novo ainda não rastreado mostra o conteúdo como linhas adicionadas.
pub fn diff_of(cwd: &Path, path: &str) -> Result<String, String> {
    if !is_safe_relative(path) {
        return Err(format!("caminho fora do projeto: `{path}`"));
    }
    let base = base(cwd)?;
    let diff = run_git(cwd, &["diff", &base, "--", path])?.unwrap_or_default();
    if !diff.is_empty() {
        return Ok(diff);
    }

    let full = cwd.join(path);
    let size = std::fs::metadata(&full).map(|m| m.len()).unwrap_or(0);
    if size > MAX_NEW_FILE_BYTES {
        return Ok("Arquivo grande demais para mostrar aqui.".into());
    }
    match std::fs::read_to_string(&full) {
        Ok(text) => Ok(text.lines().map(|l| format!("+{l}\n")).collect()),
        Err(_) => Ok(String::new()),
    }
}

/// Limite de sugestões do @arquivo.
const MAX_FILE_SUGGESTIONS: usize = 50;

/// Arquivos do projeto para o @arquivo: rastreados e novos que não estão no .gitignore.
/// Filtra pelo trecho digitado (sem diferenciar maiúsculas). Fora do git a lista fica vazia.
pub fn list_files(cwd: &Path, query: &str) -> Result<Vec<String>, String> {
    let inside = run_git(cwd, &["rev-parse", "--is-inside-work-tree"])?;
    if inside.as_deref().map(str::trim) != Some("true") {
        return Ok(Vec::new());
    }
    let listed = run_git(cwd, &["ls-files", "-z", "--cached", "--others", "--exclude-standard"])?
        .unwrap_or_default();
    let needle = query.to_lowercase();
    Ok(listed
        .split('\0')
        .filter(|p| !p.is_empty() && p.to_lowercase().contains(&needle))
        .take(MAX_FILE_SUGGESTIONS)
        .map(str::to_string)
        .collect())
}

/// Desfaz a alteração de um arquivo. Modificado ou removido volta ao HEAD; novo é apagado.
/// Renomeação não é desfeita aqui: o caminho antigo não vem na lista, então fica para o git.
pub fn discard(cwd: &Path, path: &str, status: &str) -> Result<(), String> {
    if !is_safe_relative(path) {
        return Err(format!("caminho fora do projeto: `{path}`"));
    }
    match status {
        "untracked" => std::fs::remove_file(cwd.join(path))
            .map_err(|e| format!("não foi possível apagar `{path}`: {e}")),
        "added" => git_ok(cwd, &["rm", "-f", "--", path]),
        "modified" | "deleted" => git_ok(cwd, &["restore", "--source=HEAD", "--staged", "--worktree", "--", path]),
        _ => Err("desfazer renomeação não é suportado: use o git".into()),
    }
}

/// Roda o git e falha com a saída de erro dele, se houver.
fn git_ok(cwd: &Path, args: &[&str]) -> Result<(), String> {
    let output = git(cwd)?
        .args(args)
        .output()
        .map_err(|e| format!("não foi possível rodar o git: {e}"))?;
    if output.status.success() {
        return Ok(());
    }
    Err(format!("git falhou: {}", String::from_utf8_lossy(&output.stderr).trim()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_reads_each_kind_of_change() {
        let output = " M src/a.ts\0A  novo.ts\0?? rascunho.md\0 D apagado.txt\0R  novo-nome.ts\0antigo-nome.ts\0";

        let files = parse_status(output);

        assert_eq!(
            files,
            vec![
                ("modified".into(), "src/a.ts".into()),
                ("added".into(), "novo.ts".into()),
                ("untracked".into(), "rascunho.md".into()),
                ("deleted".into(), "apagado.txt".into()),
                ("renamed".into(), "novo-nome.ts".into()),
            ]
        );
    }

    #[test]
    fn numstat_reads_counts_and_leaves_binary_unknown() {
        let output = "3\t1\tsrc/a.ts\0-\t-\timagem.png\0";

        let stats = parse_numstat(output);

        assert_eq!(stats["src/a.ts"], (Some(3), Some(1)));
        assert_eq!(stats["imagem.png"], (None, None));
    }

    #[test]
    fn numstat_reads_renamed_file_under_its_new_path() {
        let output = "2\t2\t\0antigo.ts\0novo.ts\0";

        let stats = parse_numstat(output);

        assert_eq!(stats["novo.ts"], (Some(2), Some(2)));
    }

    #[test]
    fn diff_rejects_paths_that_leave_the_project() {
        assert!(!is_safe_relative("../segredo.txt"));
        assert!(!is_safe_relative("C:\\Windows\\win.ini"));
        assert!(!is_safe_relative("/etc/passwd"));
        assert!(!is_safe_relative(""));
        assert!(is_safe_relative("src/app.ts"));
    }

    /// Repositório real: um arquivo commitado, um modificado, um novo e um apagado.
    #[test]
    fn collect_reports_a_real_git_repository() {
        let dir = std::env::temp_dir().join(format!("lunaharness-changes-{}", std::process::id()));
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
        std::fs::write(dir.join("a.txt"), "um\ndois\n").unwrap();
        std::fs::write(dir.join("b.txt"), "x\n").unwrap();
        run(&["add", "."]);
        run(&["commit", "-q", "-m", "inicial"]);

        std::fs::write(dir.join("a.txt"), "um\ndois\ntrês\n").unwrap();
        std::fs::write(dir.join("novo.txt"), "oi\n").unwrap();
        std::fs::remove_file(dir.join("b.txt")).unwrap();

        let changes = collect(&dir).unwrap();
        let _ = std::fs::remove_dir_all(&dir);

        assert!(changes.is_repo);
        let find = |p: &str| changes.files.iter().find(|f| f.path == p).unwrap().clone();
        assert_eq!(find("a.txt").status, "modified");
        assert_eq!(find("a.txt").additions, Some(1));
        assert_eq!(find("novo.txt").status, "untracked");
        assert_eq!(find("b.txt").status, "deleted");
    }

    #[test]
    fn folder_without_git_is_not_a_repo() {
        let dir = std::env::temp_dir().join(format!("lunaharness-nogit-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let changes = collect(&dir).unwrap();
        let _ = std::fs::remove_dir_all(&dir);

        // Pode haver um git acima da pasta temporária; o teste só vale quando não há.
        if !changes.is_repo {
            assert!(changes.files.is_empty());
        }
    }

    /// Desfazer volta o modificado ao HEAD, apaga o novo e não toca no resto.
    #[test]
    fn discard_restores_modified_and_removes_new_files_only() {
        let dir = std::env::temp_dir().join(format!("lunaharness-discard-{}", std::process::id()));
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
        std::fs::write(dir.join("b.txt"), "outro\n").unwrap();
        run(&["add", "-A"]);
        run(&["commit", "-q", "-m", "base"]);

        std::fs::write(dir.join("a.txt"), "alterado\n").unwrap();
        std::fs::write(dir.join("novo.txt"), "novo\n").unwrap();
        discard(&dir, "a.txt", "modified").unwrap();
        discard(&dir, "novo.txt", "untracked").unwrap();

        // No Windows o git pode restaurar com CRLF (core.autocrlf): compara sem o fim de linha.
        let restored = std::fs::read_to_string(dir.join("a.txt")).unwrap().replace("\r\n", "\n");
        assert_eq!(restored, "um\n");
        assert!(!dir.join("novo.txt").exists());
        assert_eq!(std::fs::read_to_string(dir.join("b.txt")).unwrap(), "outro\n");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn list_files_skips_ignored_files_and_filters_by_query() {
        let dir = std::env::temp_dir().join(format!("lunaharness-listfiles-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("src")).unwrap();
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
        std::fs::write(dir.join(".gitignore"), "*.log
").unwrap();
        std::fs::write(dir.join("src/Parser.ts"), "x
").unwrap();
        std::fs::write(dir.join("notas.md"), "x
").unwrap();
        std::fs::write(dir.join("erro.log"), "x
").unwrap();

        assert_eq!(list_files(&dir, "parser").unwrap(), vec!["src/Parser.ts".to_string()]);
        let all = list_files(&dir, "").unwrap();
        assert!(all.contains(&"notas.md".to_string()));
        assert!(!all.iter().any(|p| p.ends_with(".log")), "arquivo ignorado não entra");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn discard_refuses_paths_outside_the_project() {
        let dir = std::env::temp_dir();
        assert!(discard(&dir, "../x.txt", "untracked").is_err());
        assert!(discard(&dir, "a.txt", "renamed").is_err());
    }
}
