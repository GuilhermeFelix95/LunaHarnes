//! Servidores MCP: gravados nos arquivos de configuração das duas CLIs.
//!
//! - Claude Code: chave `mcpServers` em `~/.claude.json` (JSON; as outras chaves do arquivo são preservadas).
//! - Codex: tabela `[mcp_servers.<nome>]` em `~/.codex/config.toml` (toml_edit preserva comentários e formato).
//!
//! Servidor desligado sai dos arquivos e vai para `<app_data>/mcp-disabled.json`, para religar sem perder a config.
//! Todo arquivo do usuário recebe um backup `.bak-<segundos>` antes de mudar.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use tauri::AppHandle;
use toml_edit::{value, Array, DocumentMut, Item, Table};

use crate::commands::app_data_dir;
use crate::slash::home_dir;

pub const OFFICIAL_MCP: &str = include_str!("../marketplace/mcp.json");
const DISABLED_FILE: &str = "mcp-disabled.json";
const MAX_NAME_CHARS: usize = 64;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct McpServer {
    pub name: String,
    /// "stdio" (programa local) ou "http" (endereço remoto).
    pub transport: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default)]
    pub env: BTreeMap<String, String>,
    /// Onde está gravado hoje: "claude" e/ou "codex". Vazio = desligado.
    #[serde(default)]
    pub engines: Vec<String>,
    #[serde(default = "enabled_default")]
    pub enabled: bool,
}

fn enabled_default() -> bool {
    true
}

/// Item do catálogo oficial. `env` lista as variáveis que o usuário precisa preencher, sem valor.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpCatalogEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub transport: String,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub env: Vec<McpEnvField>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpEnvField {
    pub key: String,
    pub label: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct McpCatalog {
    pub servers: Vec<McpCatalogEntry>,
}

/// Nome seguro para chave de TOML e de JSON: letras, números, hífen e sublinhado.
pub fn valid_name(name: &str) -> bool {
    !name.is_empty() && name.len() <= MAX_NAME_CHARS && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Só https, ou http para o próprio computador.
fn valid_url(url: &str) -> bool {
    let url = url.trim();
    url.strip_prefix("https://").is_some_and(|rest| rest.len() > 3 && !rest.contains(char::is_whitespace))
        || url.starts_with("http://localhost") || url.starts_with("http://127.0.0.1")
}

pub fn validate(server: &McpServer) -> Result<(), String> {
    if !valid_name(&server.name) {
        return Err(format!("nome de servidor inválido: {:?}", server.name));
    }
    match server.transport.as_str() {
        "stdio" => {
            let command = server.command.as_deref().map(str::trim).unwrap_or("");
            if command.is_empty() {
                return Err(format!("o servidor `{}` precisa de um comando", server.name));
            }
        }
        "http" => {
            let url = server.url.as_deref().unwrap_or("");
            if !valid_url(url) {
                return Err(format!("o endereço de `{}` precisa ser https://", server.name));
            }
        }
        other => return Err(format!("transporte desconhecido: {other:?}")),
    }
    for key in server.env.keys() {
        if !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
            return Err(format!("nome de variável inválido: {key:?}"));
        }
    }
    Ok(())
}

/// Caminhos dos arquivos das CLIs dentro da casa do usuário.
fn claude_file(home: &Path) -> PathBuf {
    home.join(".claude.json")
}

fn codex_file(home: &Path) -> PathBuf {
    home.join(".codex").join("config.toml")
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// Grava o texto trocando o arquivo por inteiro. Se havia conteúdo diferente, guarda um backup antes.
fn write_with_backup(path: &Path, text: &str) -> Result<(), String> {
    let existing = match fs::read_to_string(path) {
        Ok(t) => t,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(e) => return Err(format!("não foi possível ler {}: {e}", path.display())),
    };
    if existing == text {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("não foi possível criar {}: {e}", parent.display()))?;
    }
    if !existing.is_empty() {
        let name = format!("{}.bak-{}", path.file_name().and_then(|n| n.to_str()).unwrap_or("arquivo"), now_secs());
        fs::write(path.with_file_name(name), &existing).map_err(|e| format!("não foi possível fazer backup de {}: {e}", path.display()))?;
    }
    let tmp = path.with_extension("luna-tmp");
    fs::write(&tmp, text).map_err(|e| format!("não foi possível gravar {}: {e}", path.display()))?;
    fs::rename(&tmp, path).map_err(|e| format!("não foi possível salvar {}: {e}", path.display()))
}

// ---- Claude Code (~/.claude.json) ----

fn read_claude(home: &Path) -> Result<Map<String, Value>, String> {
    let path = claude_file(home);
    match fs::read_to_string(&path) {
        Ok(text) if text.trim().is_empty() => Ok(Map::new()),
        Ok(text) => match serde_json::from_str::<Value>(&text) {
            Ok(Value::Object(map)) => Ok(map),
            Ok(_) => Err(format!("{} não é um objeto JSON", path.display())),
            Err(e) => Err(format!("{} está corrompido: {e}", path.display())),
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Map::new()),
        Err(e) => Err(format!("não foi possível ler {}: {e}", path.display())),
    }
}

fn claude_entry(server: &McpServer) -> Value {
    if server.transport == "http" {
        json!({ "type": "http", "url": server.url.clone().unwrap_or_default() })
    } else {
        json!({
            "type": "stdio",
            "command": server.command.clone().unwrap_or_default(),
            "args": server.args,
            "env": server.env,
        })
    }
}

fn parse_claude_entry(name: &str, entry: &Value) -> Option<McpServer> {
    let obj = entry.as_object()?;
    let mut server = McpServer { name: name.to_string(), enabled: true, engines: vec!["claude".into()], ..Default::default() };
    if let Some(url) = obj.get("url").and_then(Value::as_str) {
        server.transport = "http".into();
        server.url = Some(url.to_string());
    } else {
        server.transport = "stdio".into();
        server.command = obj.get("command").and_then(Value::as_str).map(str::to_string);
        server.args = obj.get("args").and_then(Value::as_array).map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect()).unwrap_or_default();
        server.env = obj
            .get("env")
            .and_then(Value::as_object)
            .map(|e| e.iter().filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string()))).collect())
            .unwrap_or_default();
    }
    Some(server)
}

fn write_claude(home: &Path, servers: &[McpServer]) -> Result<(), String> {
    let mut root = read_claude(home)?;
    let mut map = Map::new();
    for server in servers {
        map.insert(server.name.clone(), claude_entry(server));
    }
    if map.is_empty() {
        root.remove("mcpServers");
    } else {
        root.insert("mcpServers".into(), Value::Object(map));
    }
    let text = serde_json::to_string_pretty(&Value::Object(root)).map_err(|e| format!("falha ao gerar o JSON: {e}"))?;
    write_with_backup(&claude_file(home), &(text + "\n"))
}

// ---- Codex (~/.codex/config.toml) ----

fn read_codex(home: &Path) -> Result<DocumentMut, String> {
    let path = codex_file(home);
    match fs::read_to_string(&path) {
        Ok(text) => text.parse::<DocumentMut>().map_err(|e| format!("{} está corrompido: {e}", path.display())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(DocumentMut::new()),
        Err(e) => Err(format!("não foi possível ler {}: {e}", path.display())),
    }
}

fn codex_table(server: &McpServer) -> Table {
    let mut table = Table::new();
    if server.transport == "http" {
        table["url"] = value(server.url.clone().unwrap_or_default());
    } else {
        table["command"] = value(server.command.clone().unwrap_or_default());
        let mut args = Array::new();
        for arg in &server.args {
            args.push(arg.as_str());
        }
        table["args"] = value(args);
        if !server.env.is_empty() {
            let mut env = Table::new();
            for (key, val) in &server.env {
                env[key.as_str()] = value(val.as_str());
            }
            table["env"] = Item::Table(env);
        }
    }
    table
}

fn parse_codex_table(name: &str, table: &Table) -> McpServer {
    let text = |key: &str| table.get(key).and_then(Item::as_str).map(str::to_string);
    let mut server = McpServer { name: name.to_string(), enabled: true, engines: vec!["codex".into()], ..Default::default() };
    if let Some(url) = text("url") {
        server.transport = "http".into();
        server.url = Some(url);
    } else {
        server.transport = "stdio".into();
        server.command = text("command");
        server.args = table
            .get("args")
            .and_then(Item::as_array)
            .map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
            .unwrap_or_default();
        server.env = table
            .get("env")
            .and_then(Item::as_table)
            .map(|e| e.iter().filter_map(|(k, v)| v.as_str().map(|s| (k.to_string(), s.to_string()))).collect())
            .unwrap_or_default();
    }
    server
}

fn write_codex(home: &Path, servers: &[McpServer]) -> Result<(), String> {
    let mut doc = read_codex(home)?;
    doc.remove("mcp_servers");
    if !servers.is_empty() {
        let mut parent = Table::new();
        parent.set_implicit(true);
        for server in servers {
            parent.insert(&server.name, Item::Table(codex_table(server)));
        }
        doc.insert("mcp_servers", Item::Table(parent));
    }
    write_with_backup(&codex_file(home), &doc.to_string())
}

// ---- Desligados (<app_data>/mcp-disabled.json) ----

fn read_disabled(app_dir: &Path) -> Result<BTreeMap<String, McpServer>, String> {
    let path = app_dir.join(DISABLED_FILE);
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!("{DISABLED_FILE} está corrompido: {e}")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(BTreeMap::new()),
        Err(e) => Err(format!("não foi possível ler {DISABLED_FILE}: {e}")),
    }
}

fn write_disabled(app_dir: &Path, disabled: &BTreeMap<String, McpServer>) -> Result<(), String> {
    fs::create_dir_all(app_dir).map_err(|e| format!("não foi possível criar a pasta de dados: {e}"))?;
    let text = serde_json::to_string_pretty(disabled).map_err(|e| format!("falha ao gerar {DISABLED_FILE}: {e}"))?;
    let tmp = app_dir.join(format!("{DISABLED_FILE}.tmp"));
    fs::write(&tmp, text).map_err(|e| format!("não foi possível gravar {DISABLED_FILE}: {e}"))?;
    fs::rename(&tmp, app_dir.join(DISABLED_FILE)).map_err(|e| format!("não foi possível salvar {DISABLED_FILE}: {e}"))
}

// ---- Operações ----

/// Servidores das duas CLIs somados, mais os desligados. Um nome presente nas duas CLIs aparece uma vez.
pub fn list_in(home: &Path, app_dir: &Path) -> Result<Vec<McpServer>, String> {
    let mut found: BTreeMap<String, McpServer> = BTreeMap::new();
    for (name, entry) in read_claude(home)?.get("mcpServers").and_then(Value::as_object).into_iter().flatten() {
        if let Some(server) = parse_claude_entry(name, entry) {
            found.insert(name.clone(), server);
        }
    }
    for (name, item) in read_codex(home)?.get("mcp_servers").and_then(Item::as_table).into_iter().flat_map(|t| t.iter()) {
        if let Some(table) = item.as_table() {
            let server = parse_codex_table(name, table);
            match found.get_mut(name) {
                Some(existing) => existing.engines.push("codex".into()),
                None => {
                    found.insert(name.to_string(), server);
                }
            }
        }
    }
    for (name, mut server) in read_disabled(app_dir)? {
        server.enabled = false;
        server.engines = Vec::new();
        found.entry(name).or_insert(server);
    }
    Ok(found.into_values().collect())
}

/// Servidores que estão nos arquivos hoje (sem contar os desligados), para regravar sem perder nada.
fn active_in(home: &Path) -> Result<Vec<McpServer>, String> {
    let mut active: BTreeMap<String, McpServer> = BTreeMap::new();
    for (name, entry) in read_claude(home)?.get("mcpServers").and_then(Value::as_object).into_iter().flatten() {
        if let Some(server) = parse_claude_entry(name, entry) {
            active.insert(name.clone(), server);
        }
    }
    for (name, item) in read_codex(home)?.get("mcp_servers").and_then(Item::as_table).into_iter().flat_map(|t| t.iter()) {
        if let Some(table) = item.as_table() {
            active.entry(name.to_string()).or_insert_with(|| parse_codex_table(name, table));
        }
    }
    Ok(active.into_values().collect())
}

/// Grava (ou troca) um servidor nas duas CLIs e o tira dos desligados.
pub fn save_in(home: &Path, app_dir: &Path, server: &McpServer) -> Result<(), String> {
    validate(server)?;
    let mut active = active_in(home)?;
    active.retain(|s| s.name != server.name);
    let mut next = server.clone();
    next.enabled = true;
    active.push(next);
    write_claude(home, &active)?;
    write_codex(home, &active)?;
    let mut disabled = read_disabled(app_dir)?;
    if disabled.remove(&server.name).is_some() {
        write_disabled(app_dir, &disabled)?;
    }
    Ok(())
}

/// Liga ou desliga. Desligar tira do arquivo e guarda; ligar devolve do guardado.
pub fn set_enabled_in(home: &Path, app_dir: &Path, name: &str, enabled: bool) -> Result<(), String> {
    if !valid_name(name) {
        return Err(format!("nome de servidor inválido: {name:?}"));
    }
    let mut active = active_in(home)?;
    let mut disabled = read_disabled(app_dir)?;
    if enabled {
        let Some(server) = disabled.remove(name) else { return Ok(()) };
        active.retain(|s| s.name != name);
        active.push(server);
        write_claude(home, &active)?;
        write_codex(home, &active)?;
        write_disabled(app_dir, &disabled)
    } else {
        let Some(server) = active.iter().find(|s| s.name == name).cloned() else { return Ok(()) };
        active.retain(|s| s.name != name);
        disabled.insert(name.to_string(), server);
        write_claude(home, &active)?;
        write_codex(home, &active)?;
        write_disabled(app_dir, &disabled)
    }
}

/// Exclui de vez: tira dos arquivos e dos desligados.
pub fn remove_in(home: &Path, app_dir: &Path, name: &str) -> Result<(), String> {
    if !valid_name(name) {
        return Err(format!("nome de servidor inválido: {name:?}"));
    }
    let mut active = active_in(home)?;
    active.retain(|s| s.name != name);
    write_claude(home, &active)?;
    write_codex(home, &active)?;
    let mut disabled = read_disabled(app_dir)?;
    if disabled.remove(name).is_some() {
        write_disabled(app_dir, &disabled)?;
    }
    Ok(())
}

/// Confere o catálogo oficial e devolve a versão com a instalação preenchida (sem gravar).
pub fn official() -> Result<McpCatalog, String> {
    let catalog: McpCatalog = serde_json::from_str(OFFICIAL_MCP).map_err(|e| format!("catálogo de MCP inválido: {e}"))?;
    for entry in &catalog.servers {
        let server = entry_to_server(entry, &BTreeMap::new());
        // Só checa a forma; os valores das variáveis entram na instalação.
        let mut probe = server.clone();
        for field in &entry.env {
            probe.env.insert(field.key.clone(), "x".into());
        }
        validate(&probe)?;
    }
    Ok(catalog)
}

/// Monta o servidor a partir do catálogo e dos valores que o usuário preencheu.
pub fn entry_to_server(entry: &McpCatalogEntry, values: &BTreeMap<String, String>) -> McpServer {
    McpServer {
        name: entry.id.clone(),
        transport: entry.transport.clone(),
        command: entry.command.clone(),
        args: entry.args.clone(),
        url: entry.url.clone(),
        env: values.clone(),
        engines: Vec::new(),
        enabled: true,
    }
}

/// Instala um item do catálogo. Exige todas as variáveis pedidas e nenhuma sobrando.
pub fn install_from_catalog_in(home: &Path, app_dir: &Path, id: &str, values: &BTreeMap<String, String>) -> Result<(), String> {
    let catalog = official()?;
    let entry = catalog.servers.iter().find(|s| s.id == id).ok_or_else(|| format!("`{id}` não está no catálogo"))?;
    for field in &entry.env {
        match values.get(&field.key) {
            Some(v) if !v.trim().is_empty() => {}
            _ => return Err(format!("falta preencher {}", field.label)),
        }
    }
    for key in values.keys() {
        if !entry.env.iter().any(|f| &f.key == key) {
            return Err(format!("variável não pedida pelo catálogo: {key}"));
        }
    }
    let server = entry_to_server(entry, values);
    save_in(home, app_dir, &server)
}

fn home() -> Result<PathBuf, String> {
    home_dir().ok_or_else(|| "não foi possível localizar a pasta do usuário".to_string())
}

#[tauri::command]
pub fn list_mcp_servers(app: AppHandle) -> Result<Vec<McpServer>, String> {
    list_in(&home()?, &app_data_dir(&app)?)
}

#[tauri::command]
pub fn set_mcp_enabled(app: AppHandle, name: String, enabled: bool) -> Result<(), String> {
    set_enabled_in(&home()?, &app_data_dir(&app)?, &name, enabled)
}

#[tauri::command]
pub fn remove_mcp_server(app: AppHandle, name: String) -> Result<(), String> {
    remove_in(&home()?, &app_data_dir(&app)?, &name)
}

#[tauri::command]
pub fn load_mcp_catalog() -> Result<McpCatalog, String> {
    official()
}

#[tauri::command]
pub fn install_mcp_from_catalog(app: AppHandle, id: String, values: BTreeMap<String, String>) -> Result<(), String> {
    install_from_catalog_in(&home()?, &app_data_dir(&app)?, &id, &values)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("lunaharness-mcp-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn stdio(name: &str) -> McpServer {
        McpServer {
            name: name.into(),
            transport: "stdio".into(),
            command: Some("npx".into()),
            args: vec!["-y".into(), "pacote".into()],
            env: BTreeMap::from([("TOKEN_X".to_string(), "abc".to_string())]),
            ..Default::default()
        }
    }

    #[test]
    fn nome_e_url_seguros() {
        assert!(valid_name("memoria_1"));
        assert!(!valid_name("../x"));
        assert!(valid_url("https://mcp.exemplo.com/mcp"));
        assert!(!valid_url("http://exemplo.com"));
    }

    #[test]
    fn grava_nas_duas_cli_preservando_o_resto_do_claude_json() {
        let home = temp("save");
        fs::write(home.join(".claude.json"), r#"{"numStartups": 7, "projects": {"a": {}}}"#).unwrap();
        let app = temp("save-app");

        save_in(&home, &app, &stdio("memoria")).unwrap();

        let claude: Value = serde_json::from_str(&fs::read_to_string(home.join(".claude.json")).unwrap()).unwrap();
        assert_eq!(claude["numStartups"], 7);
        assert_eq!(claude["mcpServers"]["memoria"]["command"], "npx");
        let codex = fs::read_to_string(home.join(".codex/config.toml")).unwrap();
        assert!(codex.contains("[mcp_servers.memoria]"));
        assert!(codex.contains("TOKEN_X = \"abc\""));
    }

    #[test]
    fn config_do_codex_mantem_comentarios() {
        let home = temp("comments");
        fs::create_dir_all(home.join(".codex")).unwrap();
        fs::write(home.join(".codex/config.toml"), "# meu modelo favorito\nmodel = \"x\"\n").unwrap();

        save_in(&home, &temp("comments-app"), &stdio("memoria")).unwrap();

        let codex = fs::read_to_string(home.join(".codex/config.toml")).unwrap();
        assert!(codex.contains("# meu modelo favorito"));
        assert!(codex.contains("model = \"x\""));
    }

    #[test]
    fn desligar_tira_dos_arquivos_e_religar_devolve() {
        let home = temp("toggle");
        let app = temp("toggle-app");
        save_in(&home, &app, &stdio("memoria")).unwrap();

        set_enabled_in(&home, &app, "memoria", false).unwrap();
        let listed = list_in(&home, &app).unwrap();
        assert_eq!(listed.len(), 1);
        assert!(!listed[0].enabled);
        let claude: Value = serde_json::from_str(&fs::read_to_string(home.join(".claude.json")).unwrap()).unwrap_or(Value::Null);
        assert!(claude.get("mcpServers").is_none());

        set_enabled_in(&home, &app, "memoria", true).unwrap();
        let listed = list_in(&home, &app).unwrap();
        assert!(listed[0].enabled);
        assert_eq!(listed[0].command.as_deref(), Some("npx"));
        assert_eq!(listed[0].engines.len(), 2);
    }

    #[test]
    fn recusa_nome_ruim_e_variavel_faltando_no_catalogo() {
        let home = temp("bad");
        let app = temp("bad-app");
        assert!(save_in(&home, &app, &stdio("../fora")).is_err());
        // github pede um token: sem ele a instalação recusa, com ele grava.
        assert!(install_from_catalog_in(&home, &app, "github", &BTreeMap::new()).is_err());
        let token = BTreeMap::from([("GITHUB_PERSONAL_ACCESS_TOKEN".to_string(), "t".to_string())]);
        install_from_catalog_in(&home, &app, "github", &token).unwrap();
        assert!(list_in(&home, &app).unwrap().iter().any(|s| s.name == "github"));
    }

    #[test]
    fn remove_de_vez() {
        let home = temp("remove");
        let app = temp("remove-app");
        save_in(&home, &app, &stdio("memoria")).unwrap();
        set_enabled_in(&home, &app, "memoria", false).unwrap();

        remove_in(&home, &app, "memoria").unwrap();

        assert!(list_in(&home, &app).unwrap().is_empty());
    }

    #[test]
    fn catalogo_oficial_passa_na_validacao() {
        assert!(official().is_ok());
    }
}
