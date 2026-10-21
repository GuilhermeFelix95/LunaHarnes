//! Mudança de configuração: MCP, skills e plugins que a Luna instala pelo chat.
//! O app tira uma impressão digital antes e depois de cada turno. Se mudou, a tela avisa e oferece recarregar.
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::slash::home_dir;

/// Nomes das pastas dentro de `dir`, em ordem. Pasta ausente conta como vazia.
fn folder_names(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(dir)
        .map(|entries| {
            entries
                .flatten()
                .filter(|e| e.path().is_dir())
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .collect()
        })
        .unwrap_or_default();
    names.sort();
    names
}

/// Impressão digital da configuração que as CLIs e o app leem: só o que muda com MCP, skill ou plugin.
/// O `.claude.json` também guarda contadores do próprio Claude; por isso só a chave `mcpServers` entra.
pub fn fingerprint(home: &Path, plugins_dir: &Path) -> String {
    let claude_mcp = fs::read_to_string(home.join(".claude.json"))
        .ok()
        .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
        .and_then(|value| value.get("mcpServers").map(|servers| servers.to_string()))
        .unwrap_or_default();
    let codex_config = fs::read_to_string(home.join(".codex").join("config.toml")).unwrap_or_default();

    let mut hasher = DefaultHasher::new();
    claude_mcp.hash(&mut hasher);
    codex_config.hash(&mut hasher);
    folder_names(&home.join(".claude").join("skills")).hash(&mut hasher);
    folder_names(&home.join(".codex").join("skills")).hash(&mut hasher);
    folder_names(plugins_dir).hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Impressão digital do estado atual. Sem a pasta do usuário ou de dados, devolve erro com o motivo.
#[tauri::command(async)]
pub fn config_fingerprint(app: AppHandle) -> Result<String, String> {
    let home: PathBuf = home_dir().ok_or_else(|| "não foi possível localizar a pasta do usuário".to_string())?;
    let data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("não foi possível localizar a pasta de dados do app: {e}"))?;
    Ok(fingerprint(&home, &data.join("plugins")))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Pasta temporária única para cada teste, sem colidir com os outros.
    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("lunaharness-reload-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("home")).unwrap();
        dir
    }

    #[test]
    fn same_setup_gives_the_same_fingerprint() {
        let root = scratch("same");
        let (home, plugins) = (root.join("home"), root.join("plugins"));
        assert_eq!(fingerprint(&home, &plugins), fingerprint(&home, &plugins));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn a_new_skill_changes_the_fingerprint() {
        let root = scratch("skill");
        let (home, plugins) = (root.join("home"), root.join("plugins"));
        let before = fingerprint(&home, &plugins);
        fs::create_dir_all(home.join(".claude").join("skills").join("revisar")).unwrap();
        assert_ne!(fingerprint(&home, &plugins), before);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn a_new_mcp_server_changes_the_fingerprint() {
        let root = scratch("mcp");
        let (home, plugins) = (root.join("home"), root.join("plugins"));
        fs::write(home.join(".claude.json"), r#"{"mcpServers": {}}"#).unwrap();
        let before = fingerprint(&home, &plugins);
        fs::write(home.join(".claude.json"), r#"{"mcpServers": {"docs": {"command": "npx"}}}"#).unwrap();
        assert_ne!(fingerprint(&home, &plugins), before);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn claude_own_counters_do_not_count_as_a_change() {
        let root = scratch("counters");
        let (home, plugins) = (root.join("home"), root.join("plugins"));
        fs::write(home.join(".claude.json"), r#"{"mcpServers": {}, "numStartups": 7}"#).unwrap();
        let before = fingerprint(&home, &plugins);
        fs::write(home.join(".claude.json"), r#"{"mcpServers": {}, "numStartups": 8}"#).unwrap();
        assert_eq!(fingerprint(&home, &plugins), before);
        let _ = fs::remove_dir_all(&root);
    }
}
