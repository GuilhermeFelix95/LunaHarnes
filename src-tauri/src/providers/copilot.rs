use serde_json::Value;

use super::{Permission, ProviderEvent, RunRequest};

/// `copilot --output-format json` com o prompt pelo stdin (testado na CLI 1.0.100). Sem `--no-ask-user` a CLI
/// pausa para pedir permissão e trava a execução sem terminal. A permissão vira lista de ferramentas liberadas:
/// `view` (leitura) e `apply_patch` (edição, nome real da ferramenta de escrita); o acesso total libera tudo.
pub fn args(request: &RunRequest) -> Vec<String> {
    let mut args: Vec<String> = ["--output-format", "json", "--no-ask-user"].map(String::from).into();
    match request.permission {
        Permission::ReadOnly => args.extend(["--allow-tool".to_string(), "view".to_string()]),
        Permission::AcceptEdits => args.extend(["--allow-tool", "view", "--allow-tool", "apply_patch"].map(String::from)),
        Permission::FullAccess => args.push("--allow-all-tools".into()),
    }
    if let Some(id) = &request.session_id {
        args.push(format!("--resume={id}"));
    }
    if let Some(model) = &request.model {
        args.extend(["--model".to_string(), model.clone()]);
    }
    if let Some(effort) = &request.effort {
        args.extend(["--reasoning-effort".to_string(), effort.clone()]);
    }
    args
}

/// Detalhe curto da ferramenta: o caminho do arquivo ou o comando.
fn tool_detail(input: &Value) -> String {
    ["path", "command"]
        .iter()
        .find_map(|key| input[*key].as_str())
        .unwrap_or_default()
        .to_string()
}

/// Uma linha do `copilot --output-format json` (JSONL). Formato capturado com a CLI 1.0.100: o texto vem em
/// `assistant.message_delta`; `assistant.message` traz o texto inteiro e o modelo; ferramentas em `tool.execution_*`;
/// `result` no fim com o id da sessão (para `--resume`) e o código de saída.
/// Eventos de sessão, de MCP e de contagem não viram nada no chat.
pub fn parse_line(line: &str) -> Vec<ProviderEvent> {
    let value: Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => {
            return vec![ProviderEvent::Error {
                message: "copilot: linha de saída não é JSON válido".into(),
            }]
        }
    };
    let data = &value["data"];
    match value["type"].as_str() {
        Some("assistant.message_delta") => data["deltaContent"]
            .as_str()
            .map(|text| vec![ProviderEvent::TextDelta { text: text.to_string() }])
            .unwrap_or_default(),
        Some("assistant.message") => data["model"]
            .as_str()
            .map(|model| vec![ProviderEvent::ModelUsed { model: model.to_string() }])
            .unwrap_or_default(),
        Some("tool.execution_start") => vec![ProviderEvent::ToolUse {
            id: data["toolCallId"].as_str().unwrap_or_default().to_string(),
            name: data["toolName"].as_str().unwrap_or_default().to_string(),
            detail: tool_detail(&data["arguments"]),
        }],
        Some("tool.execution_complete") => vec![ProviderEvent::ToolResult {
            id: data["toolCallId"].as_str().unwrap_or_default().to_string(),
            ok: data["success"].as_bool() == Some(true),
            output: String::new(),
        }],
        Some("result") => {
            let mut events = Vec::new();
            if let Some(id) = value["sessionId"].as_str() {
                events.push(ProviderEvent::SessionStarted { session_id: id.to_string() });
            }
            match value["exitCode"].as_i64() {
                Some(0) | None => {}
                Some(code) => events.push(ProviderEvent::Error {
                    message: format!("copilot: terminou com código {code}"),
                }),
            }
            events
        }
        _ => vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::super::ProviderKind;
    use super::*;

    fn request(permission: Permission) -> RunRequest {
        RunRequest {
            provider: ProviderKind::Copilot,
            prompt: "x".into(),
            session_id: None,
            cwd: ".".into(),
            permission,
            browser: Default::default(),
            subagents: false,
            model: None,
            effort: None,
            profile: None,
            images: vec![],
            context_window: None,
            long_cache: false,
        }
    }

    #[test]
    fn every_mode_asks_nothing_and_allows_only_its_tools() {
        let read = args(&request(Permission::ReadOnly));
        assert!(read.contains(&"--no-ask-user".to_string()));
        assert_eq!(read.iter().filter(|a| *a == "--allow-tool").count(), 1);
        assert!(!read.contains(&"apply_patch".to_string()));

        let edit = args(&request(Permission::AcceptEdits));
        assert!(edit.contains(&"apply_patch".to_string()));

        let full = args(&request(Permission::FullAccess));
        assert!(full.contains(&"--allow-all-tools".to_string()));
    }

    #[test]
    fn resume_model_and_effort_become_flags() {
        let mut req = request(Permission::AcceptEdits);
        req.session_id = Some("e24b7bcc".into());
        req.model = Some("gpt-5.6-luna".into());
        req.effort = Some("high".into());
        let built = args(&req);
        assert!(built.contains(&"--resume=e24b7bcc".to_string()));
        assert_eq!(&built[built.len() - 4..], ["--model", "gpt-5.6-luna", "--reasoning-effort", "high"]);
    }

    #[test]
    fn text_comes_from_deltas_and_the_full_message_only_names_the_model() {
        let delta = r#"{"type":"assistant.message_delta","data":{"messageId":"m","deltaContent":"ok"}}"#;
        let message = r#"{"type":"assistant.message","data":{"content":"ok","model":"gpt-5.6-luna","toolRequests":[]}}"#;
        assert_eq!(parse_line(delta), vec![ProviderEvent::TextDelta { text: "ok".into() }]);
        assert_eq!(parse_line(message), vec![ProviderEvent::ModelUsed { model: "gpt-5.6-luna".into() }]);
    }

    #[test]
    fn tool_call_and_result_are_linked_by_id() {
        let start = r#"{"type":"tool.execution_start","data":{"toolCallId":"call_1","toolName":"view","arguments":{"path":"C:\\a.txt"}}}"#;
        let end = r#"{"type":"tool.execution_complete","data":{"toolCallId":"call_1","success":true,"result":{"content":"x"}}}"#;
        assert_eq!(
            parse_line(start),
            vec![ProviderEvent::ToolUse { id: "call_1".into(), name: "view".into(), detail: "C:\\a.txt".into() }]
        );
        assert_eq!(parse_line(end), vec![ProviderEvent::ToolResult { id: "call_1".into(), ok: true, output: String::new() }]);
    }

    #[test]
    fn the_result_line_keeps_the_session_and_reports_a_failed_exit() {
        let ok = r#"{"type":"result","sessionId":"e24b7bcc","exitCode":0}"#;
        assert_eq!(parse_line(ok), vec![ProviderEvent::SessionStarted { session_id: "e24b7bcc".into() }]);
        let failed = r#"{"type":"result","sessionId":"e24b7bcc","exitCode":1}"#;
        assert!(matches!(parse_line(failed).last(), Some(ProviderEvent::Error { .. })));
    }

    #[test]
    fn session_and_mcp_noise_gives_no_events() {
        assert!(parse_line(r#"{"type":"session.mcp_server_status_changed","data":{}}"#).is_empty());
        assert!(parse_line(r#"{"type":"user.message","data":{"content":"oi"}}"#).is_empty());
    }
}
