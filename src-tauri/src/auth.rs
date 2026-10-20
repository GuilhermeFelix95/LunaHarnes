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
    // O Cline não tem um comando de status sem interação: o login fica no arquivo de provedores.
    let (args, label): (&[&str], &str) = match kind {
        ProviderKind::Claude => (&["auth", "status"], "Claude Code"),
        ProviderKind::Codex => (&["login", "status"], "Codex"),
        ProviderKind::OpenCode => (&["auth", "list"], "OpenCode"),
        ProviderKind::Cline => return Ok(crate::providers::cline::logged_in()),
    };
    let program = resolve_program(cli_name(kind)).ok_or_else(|| {
        format!("{label} não encontrado no PATH. Instale o CLI antes de entrar na conta.")
    })?;

    let output = hidden_command(&program)
        .args(args)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .map_err(|e| format!("não foi possível consultar o login do {label}: {e}"))?;

    Ok(match kind {
        ProviderKind::Claude => parse_claude_status(&String::from_utf8_lossy(&output.stdout)),
        ProviderKind::Codex => output.status.success(),
        // `auth list` marca com "stored" cada provedor com credencial salva; sem nenhum, a lista não traz essa marca.
        ProviderKind::OpenCode => output.status.success() && String::from_utf8_lossy(&output.stdout).contains("stored"),
        ProviderKind::Cline => unreachable!("o Cline já retornou acima"),
    })
}

/// Programa e argumentos do login oficial. O programa vem já resolvido: logo após instalar o CLI,
/// o PATH do app ainda não tem a pasta nova, e um nome puro não seria encontrado.
fn login_invocation(kind: ProviderKind, resolved: Option<PathBuf>) -> Result<(String, &'static [&'static str]), String> {
    let (name, args): (&str, &'static [&'static str]) = match kind {
        ProviderKind::Claude => ("claude", &["auth", "login"]),
        ProviderKind::Codex => ("codex", &["login"]),
        ProviderKind::OpenCode => ("opencode", &["auth", "login"]),
        ProviderKind::Cline => ("cline", &["auth"]),
    };
    let program = resolved.ok_or_else(|| {
        format!("{name} não encontrado no PATH. Instale o CLI antes de entrar na conta.")
    })?;
    Ok((program.to_string_lossy().into_owned(), args))
}

/// Abre uma janela do terminal com o fluxo de login oficial do CLI.
/// O login é interativo (navegador), então roda na janela própria, não no chat.
pub fn open_login(kind: ProviderKind) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("o login pelo app é suportado só no Windows por enquanto".into());
    }
    let (program, args) = login_invocation(kind, resolve_program(cli_name(kind)))?;

    Command::new("cmd")
        .args(["/C", "start", "LunaHarness - login", "cmd", "/K"])
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
    fn login_reports_a_missing_cli_with_its_name() {
        let err = login_invocation(ProviderKind::Codex, None).unwrap_err();

        assert!(err.contains("codex"));
        assert!(err.contains("não encontrado"));
    }
}
