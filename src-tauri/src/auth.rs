use std::process::{Command, Stdio};

use crate::providers::{cli_name, ProviderKind};
use crate::session::resolve_program;

/// Interpreta a saída de `claude auth status`, que é JSON com o campo `loggedIn`.
pub fn parse_claude_status(output: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(output)
        .ok()
        .and_then(|v| v.get("loggedIn").and_then(serde_json::Value::as_bool))
        .unwrap_or(false)
}

/// Consulta o login do provedor no próprio CLI. Nenhuma credencial é lida pelo app.
pub fn status(kind: ProviderKind) -> Result<bool, String> {
    let (args, label): (&[&str], &str) = match kind {
        ProviderKind::Claude => (&["auth", "status"], "Claude Code"),
        ProviderKind::Codex => (&["login", "status"], "Codex"),
    };
    let program = resolve_program(cli_name(kind)).ok_or_else(|| {
        format!("{label} não encontrado no PATH. Instale o CLI antes de entrar na conta.")
    })?;

    let output = Command::new(&program)
        .args(args)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .map_err(|e| format!("não foi possível consultar o login do {label}: {e}"))?;

    Ok(match kind {
        ProviderKind::Claude => parse_claude_status(&String::from_utf8_lossy(&output.stdout)),
        ProviderKind::Codex => output.status.success(),
    })
}

/// Abre uma janela do terminal com o fluxo de login oficial do CLI.
/// O login é interativo (navegador), então roda na janela própria, não no chat.
pub fn open_login(kind: ProviderKind) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("o login pelo app é suportado só no Windows por enquanto".into());
    }
    let (program, args): (&str, &[&str]) = match kind {
        ProviderKind::Claude => ("claude", &["auth", "login"]),
        ProviderKind::Codex => ("codex", &["login"]),
    };

    Command::new("cmd")
        .args(["/C", "start", "LunaHarness - login", "cmd", "/K", program])
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
}
