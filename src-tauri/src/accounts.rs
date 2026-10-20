//! Contas extras de uma CLI: cada uma tem a própria pasta de login (`CLAUDE_CONFIG_DIR` no Claude,
//! `CODEX_HOME` no Codex). Metadados em `<app_data>/accounts.json`, sem segredo; as pastas em `<app_data>/accounts/<id>/`.
//! Regras, MCP e skills são copiados da pasta padrão na criação (cópia, não sincroniza depois).
//! Credenciais nunca são copiadas: o login é feito de novo dentro da conta.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::conversations::is_valid_id;
use crate::providers::ProviderKind;

const FILE_NAME: &str = "accounts.json";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub provider: ProviderKind,
    pub name: String,
}

/// Motores que aceitam conta extra. O Antigravity guarda o login no cofre do Windows (uma entrada só),
/// então não tem como isolar uma segunda conta.
pub fn supported(provider: ProviderKind) -> bool {
    matches!(
        provider,
        ProviderKind::Claude | ProviderKind::Codex | ProviderKind::OpenCode | ProviderKind::Cline | ProviderKind::Copilot
    )
}

/// Pasta de uma conta. O id vem do app (`<motor>-<millis>`), mas é validado mesmo assim: não pode sair da pasta de dados.
pub fn dir(app_data: &Path, id: &str) -> Result<PathBuf, String> {
    if !is_valid_id(id) {
        return Err(format!("id de conta inválido: `{id}`"));
    }
    Ok(app_data.join("accounts").join(id))
}

/// Variáveis que o CLI recebe nesta execução para usar a pasta da conta.
pub fn env_for(provider: ProviderKind, account_dir: &Path) -> Vec<(String, String)> {
    let value = account_dir.display().to_string();
    match provider {
        ProviderKind::Claude => vec![("CLAUDE_CONFIG_DIR".into(), value)],
        ProviderKind::Codex => vec![("CODEX_HOME".into(), value)],
        // O OpenCode guarda login, estado e configuração em pastas XDG: as três apontam para a pasta da conta.
        ProviderKind::OpenCode => vec![
            ("XDG_DATA_HOME".into(), value.clone()),
            ("XDG_STATE_HOME".into(), value.clone()),
            ("XDG_CONFIG_HOME".into(), value),
        ],
        ProviderKind::Cline => vec![("CLINE_DIR".into(), value)],
        ProviderKind::Copilot => vec![("COPILOT_HOME".into(), value)],
        _ => Vec::new(),
    }
}

/// Lê as contas. Arquivo ausente = nenhuma conta ainda.
pub fn load_all(app_data: &Path) -> Result<Vec<Account>, String> {
    let path = app_data.join(FILE_NAME);
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!("{FILE_NAME} está corrompido: {e}")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(e) => Err(format!("não foi possível ler {FILE_NAME}: {e}")),
    }
}

fn save_all(app_data: &Path, accounts: &[Account]) -> Result<(), String> {
    fs::create_dir_all(app_data).map_err(|e| format!("não foi possível criar a pasta de dados: {e}"))?;
    let json = serde_json::to_string_pretty(accounts).map_err(|e| format!("falha ao gerar {FILE_NAME}: {e}"))?;
    let tmp = app_data.join(format!("{FILE_NAME}.tmp"));
    fs::write(&tmp, json).map_err(|e| format!("não foi possível gravar {FILE_NAME}: {e}"))?;
    fs::rename(&tmp, app_data.join(FILE_NAME)).map_err(|e| format!("não foi possível salvar {FILE_NAME}: {e}"))
}

/// Cria a conta: pasta própria, regras/MCP/skills copiados de `home` e a conta gravada na lista.
pub fn create(app_data: &Path, home: &Path, provider: ProviderKind, name: &str) -> Result<Account, String> {
    if provider == ProviderKind::Antigravity {
        return Err("o Antigravity guarda o login no cofre do Windows e não aceita conta extra".into());
    }
    if !supported(provider) {
        return Err(format!("contas extras ainda não são suportadas para {provider:?}"));
    }
    let name = name.trim();
    if name.is_empty() {
        return Err("o nome da conta não pode ficar vazio".into());
    }
    let millis = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    let id = format!("{}-{millis}", slug(provider));
    let account_dir = dir(app_data, &id)?;
    fs::create_dir_all(&account_dir).map_err(|e| format!("não foi possível criar a pasta da conta `{id}`: {e}"))?;
    copy_shared_config(home, &account_dir, provider).map_err(|e| format!("não foi possível copiar a configuração para a conta `{id}`: {e}"))?;

    let account = Account { id, provider, name: name.to_string() };
    let mut all = load_all(app_data)?;
    all.push(account.clone());
    save_all(app_data, &all)?;
    Ok(account)
}

fn slug(provider: ProviderKind) -> &'static str {
    match provider {
        ProviderKind::Claude => "claude",
        ProviderKind::Codex => "codex",
        ProviderKind::OpenCode => "opencode",
        ProviderKind::Cline => "cline",
        ProviderKind::Copilot => "copilot",
        _ => "outro",
    }
}

/// Copia só o que é configuração compartilhada. Credenciais (`.credentials.json`, `auth.json`) ficam de fora de propósito.
fn copy_shared_config(home: &Path, dest: &Path, provider: ProviderKind) -> Result<(), String> {
    match provider {
        ProviderKind::Claude => {
            let src = home.join(".claude");
            copy_file_if_exists(&src.join("CLAUDE.md"), &dest.join("CLAUDE.md"))?;
            copy_dir_if_exists(&src.join("skills"), &dest.join("skills"))?;
            // O MCP do Claude fica em ~/.claude.json, mas com CLAUDE_CONFIG_DIR ele é lido da pasta da conta.
            // Só a chave mcpServers entra: o resto do arquivo é contador e identidade do usuário.
            copy_mcp_servers(&home.join(".claude.json"), &dest.join(".claude.json"))?;
        }
        ProviderKind::Codex => {
            let src = home.join(".codex");
            copy_file_if_exists(&src.join("AGENTS.md"), &dest.join("AGENTS.md"))?;
            copy_file_if_exists(&src.join("config.toml"), &dest.join("config.toml"))?;
            copy_dir_if_exists(&src.join("skills"), &dest.join("skills"))?;
        }
        _ => {}
    }
    Ok(())
}

fn copy_file_if_exists(src: &Path, dest: &Path) -> Result<(), String> {
    if !src.is_file() {
        return Ok(());
    }
    fs::copy(src, dest).map(|_| ()).map_err(|e| format!("falha ao copiar {}: {e}", src.display()))
}

fn copy_dir_if_exists(src: &Path, dest: &Path) -> Result<(), String> {
    if !src.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(dest).map_err(|e| format!("falha ao criar {}: {e}", dest.display()))?;
    for entry in fs::read_dir(src).map_err(|e| format!("falha ao ler {}: {e}", src.display()))?.flatten() {
        let from = entry.path();
        let to = dest.join(entry.file_name());
        if from.is_dir() {
            copy_dir_if_exists(&from, &to)?;
        } else {
            fs::copy(&from, &to).map_err(|e| format!("falha ao copiar {}: {e}", from.display()))?;
        }
    }
    Ok(())
}

fn copy_mcp_servers(src: &Path, dest: &Path) -> Result<(), String> {
    let Ok(text) = fs::read_to_string(src) else {
        return Ok(());
    };
    let parsed: Value = serde_json::from_str(&text).map_err(|e| format!("{} não é JSON válido: {e}", src.display()))?;
    let Some(servers) = parsed.get("mcpServers") else {
        return Ok(());
    };
    let text = serde_json::to_string_pretty(&json!({ "mcpServers": servers }))
        .map_err(|e| format!("falha ao gerar a configuração de MCP: {e}"))?;
    fs::write(dest, text).map_err(|e| format!("falha ao gravar {}: {e}", dest.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("lunaharness-accounts-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn each_cli_gets_its_own_config_variable() {
        let dir = Path::new("C:\\app\\accounts\\x");
        assert_eq!(env_for(ProviderKind::Claude, dir)[0].0, "CLAUDE_CONFIG_DIR");
        assert_eq!(env_for(ProviderKind::Codex, dir)[0].0, "CODEX_HOME");
        assert_eq!(env_for(ProviderKind::Cline, dir)[0].0, "CLINE_DIR");
        assert_eq!(env_for(ProviderKind::Copilot, dir)[0].0, "COPILOT_HOME");
    }

    #[test]
    fn opencode_isolates_data_state_and_config_together() {
        let dir = Path::new("C:\\app\\accounts\\x");
        let names: Vec<String> = env_for(ProviderKind::OpenCode, dir).into_iter().map(|(k, _)| k).collect();

        assert_eq!(names, ["XDG_DATA_HOME", "XDG_STATE_HOME", "XDG_CONFIG_HOME"]);
    }

    #[test]
    fn antigravity_has_no_account_folder() {
        assert!(!supported(ProviderKind::Antigravity));
        assert!(env_for(ProviderKind::Antigravity, Path::new("X")).is_empty());
    }

    #[test]
    fn create_copies_rules_skills_and_mcp_but_never_credentials() {
        let root = temp("copy");
        let home = root.join("home");
        let app = root.join("app");
        fs::create_dir_all(home.join(".claude/skills/revisar")).unwrap();
        fs::write(home.join(".claude/CLAUDE.md"), "regra global").unwrap();
        fs::write(home.join(".claude/skills/revisar/SKILL.md"), "skill").unwrap();
        fs::write(home.join(".claude/.credentials.json"), "segredo").unwrap();
        fs::write(home.join(".claude.json"), r#"{"mcpServers":{"figma":{"command":"x"}},"numStartups":42}"#).unwrap();

        let account = create(&app, &home, ProviderKind::Claude, "  Trabalho ").unwrap();
        let acct = dir(&app, &account.id).unwrap();

        assert_eq!(account.name, "Trabalho");
        assert_eq!(fs::read_to_string(acct.join("CLAUDE.md")).unwrap(), "regra global");
        assert!(acct.join("skills/revisar/SKILL.md").is_file());
        assert!(!acct.join(".credentials.json").exists());
        let mcp: Value = serde_json::from_str(&fs::read_to_string(acct.join(".claude.json")).unwrap()).unwrap();
        assert!(mcp["mcpServers"]["figma"].is_object());
        assert!(mcp.get("numStartups").is_none());
        assert_eq!(load_all(&app).unwrap(), vec![account]);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn create_refuses_unsupported_clis_and_empty_names() {
        let root = temp("refuse");
        let refused = create(&root, &root, ProviderKind::Antigravity, "x").unwrap_err();
        assert!(refused.contains("cofre do Windows"));
        assert!(create(&root, &root, ProviderKind::Claude, "   ").is_err());
        assert!(load_all(&root).unwrap().is_empty());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn account_ids_cannot_leave_the_accounts_folder() {
        let root = Path::new("/dados");
        assert!(dir(root, "../fora").is_err());
        assert_eq!(dir(root, "claude-1").unwrap(), root.join("accounts").join("claude-1"));
    }
}
