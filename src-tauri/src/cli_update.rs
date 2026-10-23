//! Aviso de versão nova das CLIs e atualização que só roda com a confirmação da pessoa.
//! Só Claude Code, Codex, Copilot e Cline têm fonte de versão e comando confirmados; as demais só mostram o link do instalador.

use std::time::Duration;

use serde::Serialize;
use tauri::State;

use crate::claude_plugins::{require_confirmation, run_with_timeout};
use crate::commands::ActiveRuns;
use crate::providers::ProviderKind;
use crate::session::{hidden_command, resolve_program};

const VERSION_TIMEOUT: Duration = Duration::from_secs(20);
const LATEST_TIMEOUT: Duration = Duration::from_secs(30);
const UPDATE_TIMEOUT: Duration = Duration::from_secs(300);

/// Todas as CLIs que aparecem na página Contas, na mesma ordem de `cli_status`.
const ALL_CLIS: [ProviderKind; 7] = [
    ProviderKind::Claude,
    ProviderKind::Codex,
    ProviderKind::OpenCode,
    ProviderKind::Cline,
    ProviderKind::Copilot,
    ProviderKind::Antigravity,
    ProviderKind::Hermes,
];

/// Comando de atualização: programa e argumentos, sem passar por shell.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateCommand {
    pub program: &'static str,
    pub args: Vec<String>,
}

/// Situação de uma CLI para o aviso: versões, se há atualização e se o app consegue atualizar.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliUpdateInfo {
    pub provider: ProviderKind,
    pub installed: Option<String>,
    pub latest: Option<String>,
    pub update_available: bool,
    /// Tem comando confirmado: o botão Atualizar aparece. Sem ele, o aviso leva só ao instalador oficial.
    pub can_update: bool,
    /// Falha ao consultar a versão mais nova. A tela mostra a mensagem; não repete sozinha.
    pub error: Option<String>,
}

/// Pacote npm que diz a versão mais nova. `None` = sem fonte confirmada, o aviso não sai.
pub fn npm_package(kind: ProviderKind) -> Option<&'static str> {
    match kind {
        ProviderKind::Claude => Some("@anthropic-ai/claude-code"),
        ProviderKind::Codex => Some("@openai/codex"),
        ProviderKind::Copilot => Some("@github/copilot"),
        ProviderKind::Cline => Some("cline"),
        ProviderKind::OpenCode | ProviderKind::Antigravity | ProviderKind::Hermes => None,
    }
}

/// Comando que atualiza a CLI. `None` = sem comando confirmado: o app mostra só o link oficial.
pub fn update_command(kind: ProviderKind) -> Option<UpdateCommand> {
    let npm_install = |package: &str| UpdateCommand {
        program: "npm",
        args: vec!["install".into(), "-g".into(), package.into()],
    };
    match kind {
        ProviderKind::Claude => Some(UpdateCommand { program: "claude", args: vec!["update".into()] }),
        ProviderKind::Codex => Some(npm_install("@openai/codex@latest")),
        ProviderKind::Copilot => Some(npm_install("@github/copilot@latest")),
        ProviderKind::Cline => Some(npm_install("cline@latest")),
        ProviderKind::OpenCode | ProviderKind::Antigravity | ProviderKind::Hermes => None,
    }
}

/// Versão `X.Y.Z` da saída de `--version`, mesmo com texto antes ou depois. `None` se não achar.
pub fn parse_version(raw: &str) -> Option<String> {
    raw.split_whitespace()
        .map(|token| token.trim_end_matches('.').trim_start_matches('v'))
        .find(|token| {
            let parts: Vec<&str> = token.split('.').collect();
            parts.len() == 3 && parts.iter().all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()))
        })
        .map(String::from)
}

/// Compara como números: 1.10.0 é mais nova que 1.9.0.
pub fn is_newer(latest: &str, installed: &str) -> bool {
    fn triple(version: &str) -> Option<(u64, u64, u64)> {
        let mut parts = version.split('.').map(|p| p.parse::<u64>().ok());
        Some((parts.next()??, parts.next()??, parts.next()??))
    }
    match (triple(latest), triple(installed)) {
        (Some(latest), Some(installed)) => latest > installed,
        _ => false,
    }
}

/// Recusa atualizar enquanto houver execução de agente ativa.
pub fn check_no_active_run(active: usize) -> Result<(), String> {
    if active == 0 {
        Ok(())
    } else {
        Err("há uma resposta em andamento; atualize a CLI quando ela terminar".into())
    }
}

/// Lê a versão instalada pelo mesmo caminho que o app usa para rodar a CLI.
fn installed_version(kind: ProviderKind) -> Option<String> {
    let program = resolve_program(crate::providers::cli_name(kind))?;
    let mut command = hidden_command(program);
    command.arg("--version");
    let output = run_with_timeout(command, VERSION_TIMEOUT).ok()?;
    if !output.success {
        return None;
    }
    parse_version(&output.stdout)
}

/// Versão mais nova no registro npm. Erro vira mensagem para a tela.
fn latest_version(package: &str) -> Result<String, String> {
    let program = resolve_program("npm").ok_or("o npm não foi encontrado; não dá para verificar a versão nova")?;
    let mut command = hidden_command(program);
    command.args(["view", package, "version"]);
    let output = run_with_timeout(command, LATEST_TIMEOUT).map_err(|e| format!("não foi possível consultar a versão nova: {e}"))?;
    if !output.success {
        return Err("não foi possível consultar a versão nova; tente de novo mais tarde".into());
    }
    parse_version(&output.stdout).ok_or_else(|| "o registro não informou uma versão válida".into())
}

fn check_one(kind: ProviderKind) -> CliUpdateInfo {
    let installed = installed_version(kind);
    let can_update = update_command(kind).is_some();
    let (latest, error) = match npm_package(kind) {
        None => (None, None),
        Some(package) => match latest_version(package) {
            Ok(version) => (Some(version), None),
            Err(message) => (None, Some(message)),
        },
    };
    let update_available = match (&installed, &latest) {
        (Some(installed), Some(latest)) => is_newer(latest, installed),
        _ => false,
    };
    CliUpdateInfo { provider: kind, installed, latest, update_available, can_update, error }
}

/// Situação de todas as CLIs para o aviso. Cada CLI tem o próprio erro, sem derrubar as outras.
#[tauri::command(async)]
pub fn cli_update_check() -> Vec<CliUpdateInfo> {
    ALL_CLIS.into_iter().map(check_one).collect()
}

/// Atualiza uma CLI. Só roda com confirmação da pessoa e sem nenhuma resposta do agente em andamento.
#[tauri::command(async)]
pub fn cli_update_run(kind: ProviderKind, confirmed: bool, runs: State<'_, ActiveRuns>) -> Result<CliUpdateInfo, String> {
    require_confirmation(confirmed)?;
    let active = runs.0.lock().map_err(|_| "não foi possível ver as respostas em andamento")?.len();
    check_no_active_run(active)?;
    let command = update_command(kind).ok_or("esta CLI não tem atualização pelo app; use o instalador oficial")?;
    let program = resolve_program(command.program).ok_or_else(|| format!("{} não foi encontrado no PATH", command.program))?;
    let mut process = hidden_command(program);
    process.args(&command.args);
    let output = run_with_timeout(process, UPDATE_TIMEOUT)?;
    if !output.success {
        let detail = output.stderr.trim().lines().last().unwrap_or("sem detalhes");
        return Err(format!("a atualização falhou: {detail}"));
    }
    Ok(check_one(kind))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_version_from_each_cli_output() {
        assert_eq!(parse_version("2.1.305 (Claude Code)"), Some("2.1.305".into()));
        assert_eq!(parse_version("codex-cli 0.161.0"), Some("0.161.0".into()));
        assert_eq!(parse_version("GitHub Copilot CLI 1.0.100."), Some("1.0.100".into()));
        assert_eq!(parse_version("opencode v2.0.32"), Some("2.0.32".into()));
        assert_eq!(parse_version("Could not resolve the stable source release"), None);
    }

    #[test]
    fn newer_means_greater_as_numbers_not_as_text() {
        assert!(is_newer("2.1.309", "2.1.305"));
        assert!(is_newer("0.163.0", "0.161.0"));
        assert!(is_newer("1.10.0", "1.9.0"));
        assert!(!is_newer("2.1.305", "2.1.305"));
        assert!(!is_newer("1.9.0", "2.0.0"));
    }

    #[test]
    fn only_clis_with_a_confirmed_source_have_an_npm_package() {
        assert_eq!(npm_package(ProviderKind::Claude), Some("@anthropic-ai/claude-code"));
        assert_eq!(npm_package(ProviderKind::Codex), Some("@openai/codex"));
        assert_eq!(npm_package(ProviderKind::Copilot), Some("@github/copilot"));
        assert_eq!(npm_package(ProviderKind::Cline), Some("cline"));
        assert_eq!(npm_package(ProviderKind::OpenCode), None);
        assert_eq!(npm_package(ProviderKind::Hermes), None);
        assert_eq!(npm_package(ProviderKind::Antigravity), None);
    }

    #[test]
    fn each_confirmed_cli_has_an_update_command_without_shell() {
        assert_eq!(update_command(ProviderKind::Claude), Some(UpdateCommand { program: "claude", args: vec!["update".into()] }));
        assert_eq!(
            update_command(ProviderKind::Codex),
            Some(UpdateCommand { program: "npm", args: vec!["install".into(), "-g".into(), "@openai/codex@latest".into()] })
        );
        assert_eq!(
            update_command(ProviderKind::Copilot),
            Some(UpdateCommand { program: "npm", args: vec!["install".into(), "-g".into(), "@github/copilot@latest".into()] })
        );
        assert_eq!(
            update_command(ProviderKind::Cline),
            Some(UpdateCommand { program: "npm", args: vec!["install".into(), "-g".into(), "cline@latest".into()] })
        );
        assert_eq!(update_command(ProviderKind::OpenCode), None);
        assert_eq!(update_command(ProviderKind::Antigravity), None);
    }

    #[test]
    fn refuses_to_update_while_an_agent_run_is_active() {
        assert!(check_no_active_run(0).is_ok());
        assert!(check_no_active_run(1).is_err());
    }

    #[test]
    fn update_without_confirmation_is_refused() {
        assert!(require_confirmation(false).is_err());
        assert!(require_confirmation(true).is_ok());
    }
}
