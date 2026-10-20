use serde_json::{json, Value};

use super::{Permission, ProviderEvent, RunRequest};

/// `opencode run --standalone --format json` com o prompt pelo stdin (testado na CLI 2.0.32).
/// `--standalone` é obrigatório: o serviço em segundo plano não lê a configuração do ambiente desta execução.
/// A permissão vai em `OPENCODE_CONFIG_CONTENT`, ver `config_content`.
pub fn args(request: &RunRequest) -> Vec<String> {
    let mut args: Vec<String> = ["run", "--standalone", "--format", "json"].map(String::from).into();
    if let Some(id) = &request.session_id {
        args.extend(["--session".to_string(), id.clone()]);
    }
    if let Some(model) = &request.model {
        args.extend(["-m".to_string(), model.clone()]);
    }
    for image in &request.images {
        args.extend(["--file".to_string(), image.display().to_string()]);
    }
    args
}

/// Regras de permissão de cada modo da Luna, no formato do `permission` da config do OpenCode.
/// A última regra que casa vence, por isso o `*` vem primeiro.
pub fn config_content(permission: Permission) -> String {
    let read_only = json!({ "*": "deny", "read": "allow", "glob": "allow", "grep": "allow", "list": "allow" });
    let rules = match permission {
        Permission::ReadOnly => read_only,
        Permission::AcceptEdits => json!({ "*": "deny", "read": "allow", "glob": "allow", "grep": "allow", "list": "allow", "edit": "allow", "write": "allow", "patch": "allow" }),
        Permission::FullAccess => json!({ "*": "allow" }),
    };
    json!({ "permission": rules }).to_string()
}

/// Nome que a Luna mostra para cada ferramenta do OpenCode, igual ao que o Claude e o Codex usam.
fn tool_name(tool: &str) -> String {
    match tool {
        "bash" => "Bash".into(),
        "edit" | "write" | "patch" => "Editar".into(),
        "read" => "Read".into(),
        "glob" => "Glob".into(),
        "grep" => "Grep".into(),
        other => other.to_string(),
    }
}

/// Detalhe curto da ferramenta: o comando, o caminho ou o padrão de busca.
fn tool_detail(input: &Value) -> String {
    ["command", "filePath", "path", "pattern"]
        .iter()
        .find_map(|key| input[*key].as_str())
        .unwrap_or_default()
        .to_string()
}

/// Uma linha do `opencode run --format json`. Formato capturado com a CLI 2.0.32:
/// `step_start`, `tool_use` (com `part.state`), `text` e `step_finish` (com tokens).
/// O stream não traz um evento de fim confiável: quem fecha o turno é o fim do processo.
pub fn parse_line(line: &str) -> Vec<ProviderEvent> {
    let value: Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => {
            return vec![ProviderEvent::Error {
                message: "opencode: linha de saída não é JSON válido".into(),
            }]
        }
    };
    let part = &value["part"];

    match value.get("type").and_then(Value::as_str) {
        Some("step_start") => match value.get("sessionID").and_then(Value::as_str) {
            Some(id) => vec![ProviderEvent::SessionStarted {
                session_id: id.to_string(),
            }],
            None => vec![],
        },
        Some("text") => part["text"]
            .as_str()
            .map(|text| vec![ProviderEvent::TextDelta { text: text.to_string() }])
            .unwrap_or_default(),
        Some("tool_use") => {
            let id = part["id"].as_str().unwrap_or_default().to_string();
            let state = &part["state"];
            let status = state["status"].as_str().unwrap_or_default();
            // Chamada ainda sem resultado: só a linha de uso, o resultado chega depois.
            if status != "completed" && status != "error" {
                return vec![ProviderEvent::ToolUse {
                    id,
                    name: tool_name(part["tool"].as_str().unwrap_or_default()),
                    detail: tool_detail(&state["input"]),
                }];
            }
            vec![
                ProviderEvent::ToolUse {
                    id: id.clone(),
                    name: tool_name(part["tool"].as_str().unwrap_or_default()),
                    detail: tool_detail(&state["input"]),
                },
                ProviderEvent::ToolResult {
                    id,
                    ok: status == "completed",
                    output: state["output"].as_str().unwrap_or_default().to_string(),
                },
            ]
        }
        Some("step_finish") => {
            let tokens = &part["tokens"];
            match tokens["input"].as_u64() {
                Some(input) => {
                    let read = tokens["cache"]["read"].as_u64();
                    let write = tokens["cache"]["write"].as_u64();
                    vec![ProviderEvent::CacheUsage {
                        fresh: Some(input.saturating_sub(read.unwrap_or(0))),
                        read,
                        write,
                    }]
                }
                None => vec![],
            }
        }
        _ => vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CAPTURED: &str = include_str!("../../tests/fixtures/opencode_stream.jsonl");

    #[test]
    fn captured_run_gives_session_tools_and_text() {
        let events: Vec<ProviderEvent> = CAPTURED.lines().flat_map(parse_line).collect();

        assert!(matches!(events.first(), Some(ProviderEvent::SessionStarted { .. })));
        assert!(events.contains(&ProviderEvent::ToolUse {
            id: "call_function_xli3ntc4xcuq_2".into(),
            name: "Read".into(),
            detail: "sample.txt".into(),
        }));
        assert!(events.iter().any(|e| matches!(e, ProviderEvent::TextDelta { text } if text.contains("linha um"))));
    }

    #[test]
    fn completed_tool_becomes_use_then_ok_result() {
        let line = r#"{"type":"tool_use","sessionID":"s","part":{"id":"p1","type":"tool","tool":"bash","state":{"status":"completed","input":{"command":"dir"},"output":"a.txt"}}}"#;
        assert_eq!(
            parse_line(line),
            vec![
                ProviderEvent::ToolUse { id: "p1".into(), name: "Bash".into(), detail: "dir".into() },
                ProviderEvent::ToolResult { id: "p1".into(), ok: true, output: "a.txt".into() },
            ]
        );
    }

    #[test]
    fn errored_tool_reports_not_ok() {
        let line = r#"{"type":"tool_use","sessionID":"s","part":{"id":"p2","type":"tool","tool":"edit","state":{"status":"error","input":{"filePath":"a.ts"},"output":"falhou"}}}"#;
        assert!(parse_line(line).contains(&ProviderEvent::ToolResult { id: "p2".into(), ok: false, output: "falhou".into() }));
    }

    #[test]
    fn step_finish_reports_cache_split() {
        let line = r#"{"type":"step_finish","sessionID":"s","part":{"type":"step-finish","tokens":{"input":1000,"output":5,"cache":{"read":800,"write":0}}}}"#;
        assert_eq!(
            parse_line(line),
            vec![ProviderEvent::CacheUsage { fresh: Some(200), read: Some(800), write: Some(0) }]
        );
    }

    #[test]
    fn invalid_json_is_an_error_event() {
        assert!(matches!(parse_line("não é json")[0], ProviderEvent::Error { .. }));
    }

    fn request(session: Option<&str>, model: Option<&str>) -> RunRequest {
        RunRequest {
            provider: crate::providers::ProviderKind::Claude,
            prompt: "x".into(),
            session_id: session.map(String::from),
            cwd: std::path::PathBuf::from("C:\\projeto"),
            permission: Permission::ReadOnly,
            model: model.map(String::from),
            effort: None,
            profile: None,
            context_window: None,
            long_cache: false,
            images: Vec::new(),
        }
    }

    #[test]
    fn new_run_is_standalone_json_and_never_carries_the_prompt() {
        let flags = args(&request(None, Some("anthropic/claude-haiku-4-5")));

        assert_eq!(flags, ["run", "--standalone", "--format", "json", "-m", "anthropic/claude-haiku-4-5"]);
    }

    #[test]
    fn resume_passes_the_session_id() {
        let flags = args(&request(Some("ses_1"), None));

        assert_eq!(flags, ["run", "--standalone", "--format", "json", "--session", "ses_1"]);
    }

    #[test]
    fn read_only_denies_everything_but_reading() {
        let config: Value = serde_json::from_str(&config_content(Permission::ReadOnly)).unwrap();

        assert_eq!(config["permission"]["*"], "deny");
        assert_eq!(config["permission"]["read"], "allow");
        assert!(config["permission"].get("edit").is_none());
    }

    #[test]
    fn accept_edits_allows_file_edits_but_not_bash() {
        let config: Value = serde_json::from_str(&config_content(Permission::AcceptEdits)).unwrap();

        assert_eq!(config["permission"]["edit"], "allow");
        assert_eq!(config["permission"]["write"], "allow");
        assert!(config["permission"].get("bash").is_none());
        assert_eq!(config["permission"]["*"], "deny");
    }

    #[test]
    fn full_access_allows_everything() {
        let config: Value = serde_json::from_str(&config_content(Permission::FullAccess)).unwrap();

        assert_eq!(config["permission"]["*"], "allow");
    }
}
