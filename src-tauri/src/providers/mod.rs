pub mod claude;
pub mod codex;

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// CLIs oficiais suportados pelo harness.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderKind {
    Claude,
    Codex,
}

/// Permissão escolhida no composer. Cada CLI tem o próprio nome para ela (ver claude.rs e codex.rs).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Permission {
    ReadOnly,
    AcceptEdits,
    FullAccess,
}

/// Uma execução do CLI: o que enviar, em qual conversa, em qual pasta e com qual permissão.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRequest {
    pub provider: ProviderKind,
    pub prompt: String,
    /// Id devolvido pelo CLI na primeira mensagem. Ausente = conversa nova.
    pub session_id: Option<String>,
    pub cwd: PathBuf,
    pub permission: Permission,
    /// Modelo escolhido na lista que a própria CLI expõe. Ausente = padrão da CLI.
    #[serde(default)]
    pub model: Option<String>,
    /// Nível de esforço de raciocínio, com o nome que a CLI usa (ex.: "high", "xhigh").
    #[serde(default)]
    pub effort: Option<String>,
    /// Perfil de API (id em api-profiles.json). Ausente = login da própria CLI.
    /// A chave não vem aqui: o app a lê do cofre de credenciais.
    #[serde(default)]
    pub profile: Option<String>,
}

impl RunRequest {
    /// Recusa modelo ou esforço que não sejam um nome simples, antes de virarem argumento do CLI.
    pub fn validate(&self) -> Result<(), String> {
        if let Some(model) = &self.model {
            if !is_model_token(model) {
                return Err(format!("modelo inválido: {model:?}"));
            }
        }
        if let Some(effort) = &self.effort {
            if !is_plain_token(effort) {
                return Err(format!("esforço inválido: {effort:?}"));
            }
        }
        Ok(())
    }
}

/// Letras, números, `.`, `_` e `-`, sem começar por `-` (não pode parecer flag do CLI).
pub(crate) fn is_plain_token(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 100
        && !value.starts_with('-')
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
}

/// Nome de modelo: como `is_plain_token`, mas aceita `/` e `:` (slugs de agregadores, ex.: `z-ai/glm-5.2:free`).
pub fn is_model_token(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 100
        && !value.starts_with('-')
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | '/' | ':'))
}

/// Evento interno único. O frontend nunca vê o JSON bruto de cada CLI.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum ProviderEvent {
    SessionStarted { session_id: String },
    TextDelta { text: String },
    ToolUse { name: String, detail: String },
    /// Uso de uma janela de limite da conta (sessão de 5 horas ou semana). `utilization` vem de 0 a 1.
    RateLimit { window: LimitWindow, utilization: f64, resets_at: i64 },
    /// Tokens que ocupam a janela de contexto no último turno, e o tamanho dessa janela.
    Context { tokens: u64, window_size: u64 },
    /// Custo do turno em dólares, quando a CLI informa (uso com API). Com assinatura, a CLI não informa.
    Cost { usd: f64 },
    Error { message: String },
    Done { ok: bool },
}

/// Janelas de limite que o Claude informa. O nome vai para o frontend como está aqui.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum LimitWindow {
    FiveHour,
    SevenDay,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(provider: ProviderKind, permission: Permission, session_id: Option<&str>) -> RunRequest {
        RunRequest {
            provider,
            prompt: "oi".into(),
            session_id: session_id.map(String::from),
            cwd: PathBuf::from("C:\\projeto"),
            permission,
            model: None,
            effort: None,
            profile: None,
        }
    }

    fn with_model(mut request: RunRequest, model: &str, effort: &str) -> RunRequest {
        request.model = Some(model.into());
        request.effort = Some(effort.into());
        request
    }

    #[test]
    fn model_and_effort_must_be_plain_tokens() {
        let mut req = request(ProviderKind::Claude, Permission::ReadOnly, None);
        assert!(req.validate().is_ok());

        req = with_model(req, "claude-opus-5-5", "xhigh");
        assert!(req.validate().is_ok());

        // Nada que pareça flag ou traga espaço/aspas chega aos argumentos do CLI.
        assert!(with_model(request(ProviderKind::Codex, Permission::ReadOnly, None), "--help", "high")
            .validate()
            .is_err());
        assert!(with_model(request(ProviderKind::Codex, Permission::ReadOnly, None), "gpt 5", "high")
            .validate()
            .is_err());
        assert!(with_model(request(ProviderKind::Codex, Permission::ReadOnly, None), "gpt-5", "high\"x")
            .validate()
            .is_err());
    }

    #[test]
    fn model_names_accept_slashes_and_colons_from_aggregators() {
        let req = with_model(request(ProviderKind::Claude, Permission::ReadOnly, None), "z-ai/glm-5.2:free", "high");
        assert!(req.validate().is_ok());

        // Caracteres de shell continuam de fora, mesmo com as barras liberadas.
        assert!(with_model(request(ProviderKind::Claude, Permission::ReadOnly, None), "a&b", "high").validate().is_err());
    }

    #[test]
    fn claude_new_conversation_args_use_stream_and_permission_mode() {
        let args = cli_args(&request(ProviderKind::Claude, Permission::ReadOnly, None));

        assert_eq!(
            args,
            [
                "-p",
                "--output-format",
                "stream-json",
                "--verbose",
                "--include-partial-messages",
                "--permission-mode",
                "plan",
            ]
        );
    }

    #[test]
    fn claude_permission_modes_map_to_official_flags() {
        let mode = |p| {
            let args = cli_args(&request(ProviderKind::Claude, p, None));
            args[args.iter().position(|a| a == "--permission-mode").unwrap() + 1].clone()
        };

        assert_eq!(mode(Permission::ReadOnly), "plan");
        assert_eq!(mode(Permission::AcceptEdits), "acceptEdits");
        assert_eq!(mode(Permission::FullAccess), "bypassPermissions");
    }

    #[test]
    fn claude_resume_adds_session_flag() {
        let args = cli_args(&request(ProviderKind::Claude, Permission::AcceptEdits, Some("abc-123")));

        let pos = args.iter().position(|a| a == "--resume").expect("--resume presente");
        assert_eq!(args[pos + 1], "abc-123");
    }

    #[test]
    fn codex_new_conversation_uses_sandbox_flag_and_stdin_prompt() {
        let args = cli_args(&request(ProviderKind::Codex, Permission::AcceptEdits, None));

        assert_eq!(
            args,
            ["exec", "--json", "--skip-git-repo-check", "-s", "workspace-write", "-"]
        );
    }

    #[test]
    fn codex_resume_passes_sandbox_as_config_override() {
        let args = cli_args(&request(ProviderKind::Codex, Permission::ReadOnly, Some("t-1")));

        assert_eq!(
            args,
            [
                "exec",
                "-c",
                "sandbox_mode=\"read-only\"",
                "resume",
                "t-1",
                "--json",
                "--skip-git-repo-check",
                "-",
            ]
        );
    }

    #[test]
    fn codex_full_access_maps_to_danger_sandbox() {
        let args = cli_args(&request(ProviderKind::Codex, Permission::FullAccess, None));

        let pos = args.iter().position(|a| a == "-s").unwrap();
        assert_eq!(args[pos + 1], "danger-full-access");
    }

    #[test]
    fn claude_passes_model_and_effort_as_official_flags() {
        let req = with_model(request(ProviderKind::Claude, Permission::AcceptEdits, None), "opus", "max");
        let args = cli_args(&req);

        let model = args.iter().position(|a| a == "--model").expect("--model presente");
        assert_eq!(args[model + 1], "opus");
        let effort = args.iter().position(|a| a == "--effort").expect("--effort presente");
        assert_eq!(args[effort + 1], "max");
    }

    #[test]
    fn codex_passes_model_flag_and_reasoning_effort_override() {
        let req = with_model(request(ProviderKind::Codex, Permission::AcceptEdits, None), "gpt-5.5", "xhigh");

        assert_eq!(
            cli_args(&req),
            [
                "exec",
                "--json",
                "--skip-git-repo-check",
                "-s",
                "workspace-write",
                "-m",
                "gpt-5.5",
                "-c",
                "model_reasoning_effort=\"xhigh\"",
                "-",
            ]
        );
    }

    #[test]
    fn codex_resume_keeps_model_and_effort_before_the_subcommand() {
        let req = with_model(request(ProviderKind::Codex, Permission::ReadOnly, Some("t-1")), "gpt-5.5", "low");

        assert_eq!(
            cli_args(&req),
            [
                "exec",
                "-c",
                "sandbox_mode=\"read-only\"",
                "-m",
                "gpt-5.5",
                "-c",
                "model_reasoning_effort=\"low\"",
                "resume",
                "t-1",
                "--json",
                "--skip-git-repo-check",
                "-",
            ]
        );
    }

    #[test]
    fn fallback_after_silent_failure_reports_reason_and_closes_turn() {
        let events = fallback_events(ProviderKind::Codex, Some(3), "token expirado");

        assert_eq!(
            events,
            vec![
                ProviderEvent::Error {
                    message: "Codex terminou sem concluir a resposta (código 3): token expirado"
                        .into()
                },
                ProviderEvent::Done { ok: false },
            ]
        );
    }

    #[test]
    fn result_with_api_cost_reports_it_before_done() {
        let line = r#"{"type":"result","is_error":false,"total_cost_usd":0.0421,"result":"ok"}"#;
        let events = parse_line(ProviderKind::Claude, line);

        assert_eq!(
            events,
            vec![ProviderEvent::Cost { usd: 0.0421 }, ProviderEvent::Done { ok: true }]
        );
    }

    #[test]
    fn result_without_cost_keeps_the_old_events() {
        let line = r#"{"type":"result","is_error":false,"result":"ok"}"#;
        assert_eq!(parse_line(ProviderKind::Claude, line), vec![ProviderEvent::Done { ok: true }]);
    }

    #[test]
    fn serialized_event_matches_frontend_contract() {
        let json = serde_json::to_value(ProviderEvent::SessionStarted {
            session_id: "abc".into(),
        })
        .unwrap();

        // src/types.ts espera { kind: "sessionStarted", sessionId }.
        assert_eq!(json["kind"], "sessionStarted");
        assert_eq!(json["sessionId"], "abc");
    }
}

/// Traduz uma linha de saída do CLI para eventos internos.
/// Linhas que não carregam informação útil para o chat são ignoradas.
pub fn parse_line(kind: ProviderKind, line: &str) -> Vec<ProviderEvent> {
    match kind {
        ProviderKind::Claude => claude::parse_line(line),
        ProviderKind::Codex => codex::parse_line(line),
    }
}

/// Argumentos do CLI para uma execução. O prompt vai sempre pelo stdin, nunca como argumento,
/// para evitar problemas de escape no Windows (os CLIs são shims `.cmd`).
pub fn cli_args(request: &RunRequest) -> Vec<String> {
    match request.provider {
        ProviderKind::Claude => claude::args(request),
        ProviderKind::Codex => codex::args(request),
    }
}

/// Nome legível do provedor, usado em mensagens para o usuário.
pub fn label(kind: ProviderKind) -> &'static str {
    match kind {
        ProviderKind::Claude => "Claude Code",
        ProviderKind::Codex => "Codex",
    }
}

/// Eventos finais quando o CLI termina sem `Done` (crash, falta de login, rede caiu).
/// Garante que o botão "Parar" destrava e que o usuário vê o motivo.
pub fn fallback_events(kind: ProviderKind, exit_code: Option<i32>, stderr: &str) -> Vec<ProviderEvent> {
    let code = exit_code.map_or_else(|| "sem código de saída".to_string(), |c| format!("código {c}"));
    let detail = if stderr.is_empty() {
        String::new()
    } else {
        format!(": {stderr}")
    };
    vec![
        ProviderEvent::Error {
            message: format!("{} terminou sem concluir a resposta ({code}){detail}", label(kind)),
        },
        ProviderEvent::Done { ok: false },
    ]
}

/// Nome do executável como aparece no PATH.
pub fn cli_name(kind: ProviderKind) -> &'static str {
    match kind {
        ProviderKind::Claude => "claude",
        ProviderKind::Codex => "codex",
    }
}
