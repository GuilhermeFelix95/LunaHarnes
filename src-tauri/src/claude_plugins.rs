//! Plugins do Claude Code, geridos pela própria CLI (`claude plugin ...`).
//! A Luna não reimplementa o formato: lista, instala, ativa, desativa, atualiza e remove chamando a CLI
//! com `--json` quando ela oferece. Instalar e remover só rodam depois de confirmação explícita da pessoa.

use std::io::Read;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::providers::{cli_name, ProviderKind};
use crate::session::{hidden_command, resolve_program};

/// Tempo máximo de uma chamada à CLI. O catálogo completo tem milhares de entradas, então a folga é grande.
const CLI_TIMEOUT: Duration = Duration::from_secs(120);

/// Versão mínima da CLI: `plugin install --json` existe a partir dela.
const MIN_CLI_VERSION: (u32, u32, u32) = (2, 1, 268);

/// Plugin instalado, como a CLI lista.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPlugin {
    pub id: String,
    pub version: String,
    pub scope: String,
    pub enabled: bool,
    pub install_path: Option<String>,
}

/// Plugin que um marketplace oferece e que ainda não está instalado.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailablePlugin {
    pub plugin_id: String,
    pub name: String,
    pub description: String,
}

/// Instalados e disponíveis, numa só resposta. A lista disponível pode ser grande: a tela filtra.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub installed: Vec<InstalledPlugin>,
    pub available: Vec<AvailablePlugin>,
}

/// Marketplace registrado na CLI, com a origem (repositório ou pasta) que a tela mostra.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Marketplace {
    pub name: String,
    pub origin: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawInstalled {
    id: String,
    #[serde(default)]
    version: String,
    scope: String,
    enabled: bool,
    #[serde(default)]
    install_path: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawAvailable {
    plugin_id: String,
    name: String,
    #[serde(default)]
    description: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawCatalog {
    installed: Vec<RawInstalled>,
    available: Vec<RawAvailable>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawMarketplace {
    name: String,
    #[serde(default)]
    repo: Option<String>,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    url: Option<String>,
}

/// Saída de uma chamada à CLI: se terminou bem e o que ela escreveu.
pub struct CliOutput {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

fn installed_from(raw: RawInstalled) -> InstalledPlugin {
    InstalledPlugin {
        id: raw.id,
        version: raw.version,
        scope: raw.scope,
        enabled: raw.enabled,
        install_path: raw.install_path,
    }
}

pub fn parse_installed(raw: &str) -> Result<Vec<InstalledPlugin>, String> {
    let list: Vec<RawInstalled> =
        serde_json::from_str(raw).map_err(|e| format!("não foi possível ler os plugins instalados: {e}"))?;
    Ok(list.into_iter().map(installed_from).collect())
}

pub fn parse_catalog(raw: &str) -> Result<Catalog, String> {
    let catalog: RawCatalog =
        serde_json::from_str(raw).map_err(|e| format!("não foi possível ler o catálogo de plugins: {e}"))?;
    Ok(Catalog {
        installed: catalog.installed.into_iter().map(installed_from).collect(),
        available: catalog
            .available
            .into_iter()
            .map(|p| AvailablePlugin { plugin_id: p.plugin_id, name: p.name, description: p.description })
            .collect(),
    })
}

pub fn parse_marketplaces(raw: &str) -> Result<Vec<Marketplace>, String> {
    let list: Vec<RawMarketplace> =
        serde_json::from_str(raw).map_err(|e| format!("não foi possível ler os marketplaces: {e}"))?;
    Ok(list
        .into_iter()
        .map(|m| Marketplace {
            origin: m.repo.or(m.path).or(m.url).unwrap_or_default(),
            name: m.name,
        })
        .collect())
}

/// Resultado em JSON da CLI: a última linha não vazia, porque a CLI escreve o comando antes dele.
pub fn last_json_line(raw: &str) -> Option<Value> {
    let line = raw.lines().rev().map(str::trim).find(|line| !line.is_empty())?;
    serde_json::from_str(line).ok()
}

/// `nome@marketplace`, só com letras, números, `-`, `_` e `.` de cada lado.
fn valid_plugin_id(id: &str) -> bool {
    match id.split_once('@') {
        Some((name, marketplace)) => valid_part(name) && valid_part(marketplace),
        None => false,
    }
}

fn valid_part(part: &str) -> bool {
    !part.is_empty() && part.len() <= 64 && part.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
}

pub fn install_args(plugin_id: &str) -> Result<Vec<String>, String> {
    if !valid_plugin_id(plugin_id) {
        return Err(format!("identificador de plugin inválido: `{plugin_id}`. Use o formato nome@marketplace."));
    }
    Ok(["plugin", "install", plugin_id, "--scope", "user", "--json", "-y"].map(String::from).to_vec())
}

/// Aceita `dono/repo` do GitHub ou um endereço `https://`. Caminhos locais e outros esquemas ficam de fora.
pub fn marketplace_add_args(source: &str) -> Result<Vec<String>, String> {
    let github = source.split('/').count() == 2 && source.split('/').all(valid_part);
    let https = source.strip_prefix("https://").is_some_and(|rest| {
        !rest.is_empty() && !source.chars().any(|c| c.is_whitespace() || matches!(c, ';' | '&' | '|' | '`' | '$' | '"' | '\''))
    });
    if !github && !https {
        return Err(format!("origem de marketplace inválida: `{source}`. Use dono/repo do GitHub ou um endereço https."));
    }
    Ok(["plugin", "marketplace", "add", source, "--json"].map(String::from).to_vec())
}

/// Instalar ou remover só roda com a confirmação da pessoa. Sem ela, nada é executado.
pub fn require_confirmation(confirmed: bool) -> Result<(), String> {
    if confirmed {
        Ok(())
    } else {
        Err("esta ação precisa de confirmação da pessoa antes de rodar".into())
    }
}

/// Lê `X.Y.Z (Claude Code)` e diz se a versão é igual ou maior que a mínima.
pub fn cli_version_ok(raw: &str) -> bool {
    let numbers = raw.split_whitespace().next().unwrap_or("");
    let parts: Vec<u32> = numbers.split('.').filter_map(|p| p.parse().ok()).collect();
    match parts.as_slice() {
        [major, minor, patch] => (*major, *minor, *patch) >= MIN_CLI_VERSION,
        _ => false,
    }
}

/// Roda o comando, lendo a saída enquanto ele roda (senão um catálogo grande trava o pipe). Passou do
/// tempo: encerra o processo e devolve erro.
pub fn run_with_timeout(mut command: Command, timeout: Duration) -> Result<CliOutput, String> {
    command.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|e| format!("não foi possível iniciar a CLI do Claude: {e}"))?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let out_reader = std::thread::spawn(move || read_all(stdout));
    let err_reader = std::thread::spawn(move || read_all(stderr));

    let started = Instant::now();
    let success = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status.success(),
            Ok(None) if started.elapsed() >= timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("a CLI do Claude passou de {} s e foi encerrada", timeout.as_secs()));
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(20)),
            Err(e) => return Err(format!("não foi possível acompanhar a CLI do Claude: {e}")),
        }
    };
    Ok(CliOutput {
        success,
        stdout: out_reader.join().unwrap_or_default(),
        stderr: err_reader.join().unwrap_or_default(),
    })
}

fn read_all(pipe: Option<impl Read>) -> String {
    let mut text = String::new();
    if let Some(mut pipe) = pipe {
        let _ = pipe.read_to_string(&mut text);
    }
    text
}

/// Mensagem para mostrar quando a CLI falha: a do JSON, se houver; senão o que ela escreveu por último.
fn failure_message(output: &CliOutput, action: &str) -> String {
    if let Some(message) = last_json_line(&output.stdout).and_then(|v| v["message"].as_str().map(String::from)) {
        return format!("{action}: {message}");
    }
    let detail = output.stderr.trim().lines().last().or(output.stdout.trim().lines().last()).unwrap_or("sem detalhes");
    format!("{action}: {detail}")
}

fn run_claude(args: &[String]) -> Result<CliOutput, String> {
    let program = resolve_program(cli_name(ProviderKind::Claude))
        .ok_or("Claude Code não encontrado no PATH. Instale o CLI para gerir os plugins.")?;
    let mut command = hidden_command(program);
    command.args(args);
    run_with_timeout(command, CLI_TIMEOUT)
}

fn checked(args: &[String], action: &str) -> Result<CliOutput, String> {
    let output = run_claude(args)?;
    if output.success {
        Ok(output)
    } else {
        Err(failure_message(&output, action))
    }
}

/// Versão da CLI instalada, para a tela avisar quando for antiga.
#[tauri::command(async)]
pub fn claude_cli_version_ok() -> Result<bool, String> {
    let output = run_claude(&["--version".to_string()])?;
    Ok(cli_version_ok(&output.stdout))
}

/// Instalados e disponíveis nos marketplaces registrados.
#[tauri::command(async)]
pub fn claude_plugins_catalog() -> Result<Catalog, String> {
    let output = checked(&args(&["plugin", "list", "--json", "--available"]), "não foi possível listar os plugins")?;
    parse_catalog(&output.stdout)
}

/// Texto que a CLI mostra sobre um plugin: o que ele adiciona e o custo estimado. Vai para a confirmação.
#[tauri::command(async)]
pub fn claude_plugin_details(plugin_id: String) -> Result<String, String> {
    if !valid_plugin_id(&plugin_id) {
        return Err(format!("identificador de plugin inválido: `{plugin_id}`"));
    }
    let output = checked(&args(&["plugin", "details", &plugin_id]), "não foi possível ver os detalhes do plugin")?;
    Ok(output.stdout.trim().to_string())
}

#[tauri::command(async)]
pub fn claude_plugin_install(plugin_id: String, confirmed: bool) -> Result<(), String> {
    require_confirmation(confirmed)?;
    checked(&install_args(&plugin_id)?, "não foi possível instalar o plugin")?;
    Ok(())
}

#[tauri::command(async)]
pub fn claude_plugin_uninstall(plugin_id: String, confirmed: bool) -> Result<(), String> {
    require_confirmation(confirmed)?;
    if !valid_plugin_id(&plugin_id) {
        return Err(format!("identificador de plugin inválido: `{plugin_id}`"));
    }
    checked(&args(&["plugin", "uninstall", &plugin_id, "--json"]), "não foi possível remover o plugin")?;
    Ok(())
}

#[tauri::command(async)]
pub fn claude_plugin_set_enabled(plugin_id: String, enabled: bool) -> Result<(), String> {
    if !valid_plugin_id(&plugin_id) {
        return Err(format!("identificador de plugin inválido: `{plugin_id}`"));
    }
    let action = if enabled { "enable" } else { "disable" };
    checked(&args(&["plugin", action, &plugin_id]), "não foi possível alterar o plugin")?;
    Ok(())
}

#[tauri::command(async)]
pub fn claude_plugin_update(plugin_id: String) -> Result<(), String> {
    if !valid_plugin_id(&plugin_id) {
        return Err(format!("identificador de plugin inválido: `{plugin_id}`"));
    }
    checked(&args(&["plugin", "update", &plugin_id, "--json"]), "não foi possível atualizar o plugin")?;
    Ok(())
}

#[tauri::command(async)]
pub fn claude_marketplaces_list() -> Result<Vec<Marketplace>, String> {
    let output = checked(&args(&["plugin", "marketplace", "list", "--json"]), "não foi possível listar os marketplaces")?;
    parse_marketplaces(&output.stdout)
}

#[tauri::command(async)]
pub fn claude_marketplace_add(source: String) -> Result<(), String> {
    checked(&marketplace_add_args(&source)?, "não foi possível adicionar o marketplace")?;
    Ok(())
}

/// Remover um marketplace desinstala os plugins dele. Por isso também precisa de confirmação.
#[tauri::command(async)]
pub fn claude_marketplace_remove(name: String, confirmed: bool) -> Result<(), String> {
    require_confirmation(confirmed)?;
    if !valid_part(&name) {
        return Err(format!("nome de marketplace inválido: `{name}`"));
    }
    checked(&args(&["plugin", "marketplace", "remove", &name, "--json"]), "não foi possível remover o marketplace")?;
    Ok(())
}

fn args(parts: &[&str]) -> Vec<String> {
    parts.iter().map(|p| p.to_string()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const LISTA: &str = r#"[
      {"id":"feature-dev@claude-plugins-official","version":"d1adba47161a","scope":"user","enabled":true,
       "installPath":"C:\\Users\\guilh\\.claude\\plugins\\cache\\feature-dev","projectEnabled":false}
    ]"#;

    #[test]
    fn le_os_plugins_instalados_da_saida_json_da_cli() {
        let plugins = parse_installed(LISTA).unwrap();
        assert_eq!(plugins.len(), 1);
        assert_eq!(plugins[0].id, "feature-dev@claude-plugins-official");
        assert_eq!(plugins[0].scope, "user");
        assert!(plugins[0].enabled);
    }

    #[test]
    fn saida_que_nao_e_json_vira_erro_com_mensagem_clara() {
        let err = parse_installed("não é json").unwrap_err();
        assert!(err.contains("plugins instalados"), "{err}");
    }

    #[test]
    fn catalogo_separa_instalados_e_disponiveis() {
        let raw = r#"{"installed":[],"available":[
          {"pluginId":"42crunch@claude-plugins-official","name":"42crunch","description":"Auditoria de APIs"}
        ]}"#;
        let catalog = parse_catalog(raw).unwrap();
        assert!(catalog.installed.is_empty());
        assert_eq!(catalog.available[0].plugin_id, "42crunch@claude-plugins-official");
        assert_eq!(catalog.available[0].description, "Auditoria de APIs");
    }

    #[test]
    fn le_os_marketplaces_com_a_origem_de_cada_um() {
        let raw = r#"[
          {"name":"claude-plugins-official","source":"github","repo":"anthropics/claude-plugins-official","installLocation":"C:\\x"},
          {"name":"plan-sidebar-local","source":"directory","path":"C:\\dev\\plan-sidebar","installLocation":"C:\\dev\\plan-sidebar"}
        ]"#;
        let marketplaces = parse_marketplaces(raw).unwrap();
        assert_eq!(marketplaces[0].name, "claude-plugins-official");
        assert_eq!(marketplaces[0].origin, "anthropics/claude-plugins-official");
        assert_eq!(marketplaces[1].origin, "C:\\dev\\plan-sidebar");
    }

    #[test]
    fn resultado_json_e_a_ultima_linha_mesmo_com_texto_antes() {
        // A CLI imprime o comando do marketplace antes do resultado; só a última linha é o JSON.
        let saida = "Adicionando marketplace...\nInstalando plugin...\n{\"command\":\"install\",\"outcome\":\"failed\",\"message\":\"sem rede\"}\n";
        let result = last_json_line(saida).unwrap();
        assert_eq!(result["message"], "sem rede");
    }

    #[test]
    fn id_de_plugin_com_caracteres_de_shell_e_recusado() {
        assert!(install_args("feature-dev@claude-plugins-official").is_ok());
        assert!(install_args("feature-dev@claude-plugins-official; rm -rf /").is_err());
        assert!(install_args("feature dev@x").is_err());
        assert!(install_args("sem-arroba").is_err());
    }

    #[test]
    fn instalacao_passa_argumentos_separados_e_escopo_de_usuario() {
        let args = install_args("feature-dev@claude-plugins-official").unwrap();
        assert_eq!(&args[..2], ["plugin", "install"]);
        assert!(args.contains(&"feature-dev@claude-plugins-official".to_string()));
        assert!(args.windows(2).any(|w| w == ["--scope", "user"]));
        assert!(args.contains(&"--json".to_string()));
    }

    #[test]
    fn origem_de_marketplace_aceita_github_e_https_e_recusa_o_resto() {
        assert!(marketplace_add_args("anthropics/claude-code").is_ok());
        assert!(marketplace_add_args("https://example.com/marketplace.json").is_ok());
        assert!(marketplace_add_args("file:///C:/segredo").is_err());
        assert!(marketplace_add_args("C:\\dev\\marketplace").is_err());
        assert!(marketplace_add_args("dono/repo; rm -rf /").is_err());
        assert!(marketplace_add_args("http://inseguro.com/m.json").is_err());
    }

    #[test]
    fn instalar_sem_confirmacao_nao_roda() {
        let err = require_confirmation(false).unwrap_err();
        assert!(err.contains("confirmação"), "{err}");
        assert!(require_confirmation(true).is_ok());
    }

    #[test]
    fn versao_da_cli_abaixo_do_minimo_e_sinalizada() {
        assert!(cli_version_ok("2.1.305 (Claude Code)"));
        assert!(cli_version_ok("2.1.268 (Claude Code)"));
        assert!(!cli_version_ok("2.1.267 (Claude Code)"));
        assert!(!cli_version_ok("2.0.9 (Claude Code)"));
        assert!(!cli_version_ok("saída estranha"));
    }

    #[test]
    fn comando_que_passa_do_tempo_e_encerrado_com_erro() {
        let mut command = std::process::Command::new("cmd");
        command.args(["/C", "ping", "-n", "30", "127.0.0.1"]);
        let err = run_with_timeout(command, std::time::Duration::from_millis(300)).err().unwrap();
        assert!(err.contains("passou de"), "{err}");
    }
}
