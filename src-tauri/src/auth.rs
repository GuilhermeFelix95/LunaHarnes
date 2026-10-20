use std::path::PathBuf;
use std::process::{Command, Stdio};

use crate::providers::{cli_name, ProviderKind};
use crate::session::{hidden_command, resolve_program};

/// Interpreta a saída de `claude auth status`, que é JSON com o campo `loggedIn`.
pub fn parse_claude_status(output: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(output)
        .ok()
        .and_then(|v| v.get("loggedIn").and_then(serde_json::Value::as_bool))
        .unwrap_or(false)
}

/// Consulta o login do provedor no próprio CLI. Nenhuma credencial é lida pelo app.
pub fn status(kind: ProviderKind) -> Result<bool, String> {
    status_with_env(kind, &[])
}

/// Igual a `status`, com variáveis extras (a pasta de login de uma conta extra, ver accounts.rs).
pub fn status_with_env(kind: ProviderKind, env: &[(String, String)]) -> Result<bool, String> {
    // O Cline não tem um comando de status sem interação: o login fica no arquivo de provedores.
    let (args, label): (&[&str], &str) = match kind {
        ProviderKind::Claude => (&["auth", "status"], "Claude Code"),
        ProviderKind::Codex => (&["login", "status"], "Codex"),
        // --standalone: o servidor em segundo plano não lê as pastas XDG desta conta (ver accounts.rs).
        ProviderKind::OpenCode => (&["auth", "list", "--standalone"], "OpenCode"),
        ProviderKind::Cline => return Ok(crate::providers::cline::logged_in_at(env_value(env, "CLINE_DIR"))),
        // O Copilot não tem comando de status: a verificação manda uma pergunta curta (ver providers/copilot.rs).
        ProviderKind::Copilot => return Ok(crate::providers::copilot::logged_in_with(env)),
        // O Antigravity também não tem comando de status sem entrar no modo interativo: o app mostra "Conectar".
        ProviderKind::Antigravity => return Ok(false),
    };
    let program = resolve_program(cli_name(kind)).ok_or_else(|| {
        format!("{label} não encontrado no PATH. Instale o CLI antes de entrar na conta.")
    })?;

    let output = hidden_command(&program)
        .args(args)
        .envs(env.iter().map(|(k, v)| (k.as_str(), v.as_str())))
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .map_err(|e| format!("não foi possível consultar o login do {label}: {e}"))?;

    Ok(match kind {
        ProviderKind::Claude => parse_claude_status(&String::from_utf8_lossy(&output.stdout)),
        ProviderKind::Codex => output.status.success(),
        // `auth list` marca com "stored" cada provedor com credencial salva; sem nenhum, a lista não traz essa marca.
        ProviderKind::OpenCode => output.status.success() && String::from_utf8_lossy(&output.stdout).contains("stored"),
        ProviderKind::Cline | ProviderKind::Copilot | ProviderKind::Antigravity => unreachable!("o Cline, o Copilot e o Antigravity já retornaram acima"),
    })
}

/// Valor de uma variável da lista de ambiente (a pasta da conta), se existir.
fn env_value<'a>(env: &'a [(String, String)], key: &str) -> Option<&'a str> {
    env.iter().find(|(k, _)| k == key).map(|(_, v)| v.as_str())
}

/// Programa e argumentos do login oficial. O programa vem já resolvido: logo após instalar o CLI,
/// o PATH do app ainda não tem a pasta nova, e um nome puro não seria encontrado.
fn login_invocation(kind: ProviderKind, resolved: Option<PathBuf>) -> Result<(String, &'static [&'static str]), String> {
    let (name, args): (&str, &'static [&'static str]) = match kind {
        ProviderKind::Claude => ("claude", &["auth", "login"]),
        ProviderKind::Codex => ("codex", &["login"]),
        ProviderKind::OpenCode => ("opencode", &["auth", "login", "--standalone"]),
        ProviderKind::Cline => ("cline", &["auth"]),
        ProviderKind::Copilot => ("copilot", &["login"]),
        // Sem subcomando de login: o `agy` abre o fluxo de conta (Google) no próprio terminal.
        ProviderKind::Antigravity => ("agy", &[]),
    };
    let program = resolved.ok_or_else(|| {
        format!("{name} não encontrado no PATH. Instale o CLI antes de entrar na conta.")
    })?;
    Ok((program.to_string_lossy().into_owned(), args))
}

/// Abre uma janela do terminal com o fluxo de login oficial do CLI.
/// O login é interativo (navegador), então roda na janela própria, não no chat.
pub fn open_login(kind: ProviderKind) -> Result<(), String> {
    open_login_with_env(kind, &[])
}

/// Igual a `open_login`, com variáveis extras: a janela do login de uma conta extra usa a pasta dela.
pub fn open_login_with_env(kind: ProviderKind, env: &[(String, String)]) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("o login pelo app é suportado só no Windows por enquanto".into());
    }
    // Login novo: a verificação guardada do Copilot deixa de valer.
    if kind == ProviderKind::Copilot {
        crate::providers::copilot::forget_login();
    }
    let (program, args) = login_invocation(kind, resolve_program(cli_name(kind)))?;

    Command::new("cmd")
        .args(["/C", "start", "LunaCode - login", "cmd", "/K"])
        .envs(env.iter().map(|(k, v)| (k.as_str(), v.as_str())))
        .arg(&program)
        .args(args)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("não foi possível abrir a janela de login: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn logged_in_claude_status_is_true() {
        let json = r#"{"loggedIn": true, "authMethod": "claude.ai"}"#;
        assert!(parse_claude_status(json));
    }

    #[test]
    fn logged_out_or_unreadable_status_is_false() {
        assert!(!parse_claude_status(r#"{"loggedIn": false}"#));
        assert!(!parse_claude_status("not json at all"));
        assert!(!parse_claude_status(""));
    }

    #[test]
    fn login_uses_the_resolved_path_not_the_bare_name() {
        // Logo após instalar o CLI, o PATH do app ainda não tem a pasta nova: o login usa o caminho resolvido.
        let resolved = Some(std::path::PathBuf::from(r"C:\Tools\claude.exe"));
        let (program, args) = login_invocation(ProviderKind::Claude, resolved).unwrap();

        assert_eq!(program, r"C:\Tools\claude.exe");
        assert_eq!(args, ["auth", "login"]);
    }

    #[test]
    fn opencode_login_runs_standalone_so_the_account_folder_is_used() {
        let resolved = Some(std::path::PathBuf::from(r"C:\Tools\opencode.exe"));
        let (_, args) = login_invocation(ProviderKind::OpenCode, resolved).unwrap();

        assert_eq!(args, ["auth", "login", "--standalone"]);
    }

    #[test]
    fn login_reports_a_missing_cli_with_its_name() {
        let err = login_invocation(ProviderKind::Codex, None).unwrap_err();

        assert!(err.contains("codex"));
        assert!(err.contains("não encontrado"));
    }
}
