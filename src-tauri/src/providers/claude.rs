use serde_json::Value;

use super::ProviderEvent;

use super::{Permission, RunRequest};

/// `claude -p` lê o prompt do stdin e emite JSON por linha.
/// `--include-partial-messages` manda os deltas de texto conforme chegam.
pub fn args(request: &RunRequest) -> Vec<String> {
    let mut args: Vec<String> = [
        "-p",
        "--output-format",
        "stream-json",
        "--verbose",
        "--include-partial-messages",
        "--permission-mode",
        permission_mode(request.permission),
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();

    if let Some(id) = &request.session_id {
        args.push("--resume".into());
        args.push(id.clone());
    }
    args
}

fn permission_mode(permission: Permission) -> &'static str {
    match permission {
        Permission::ReadOnly => "plan",
        Permission::AcceptEdits => "acceptEdits",
        Permission::FullAccess => "bypassPermissions",
    }
}

pub fn parse_line(line: &str) -> Vec<ProviderEvent> {
    let value: Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => {
            return vec![ProviderEvent::Error {
                message: "claude: linha de saída não é JSON válido".into(),
            }]
        }
    };

    match value.get("type").and_then(Value::as_str) {
        Some("system") if value.get("subtype").and_then(Value::as_str) == Some("init") => {
            match value.get("session_id").and_then(Value::as_str) {
                Some(id) => vec![ProviderEvent::SessionStarted {
                    session_id: id.to_string(),
                }],
                None => vec![],
            }
        }
        // Texto chega em deltas (`--include-partial-messages`). O texto da mensagem `assistant`
        // completa é ignorado para não duplicar a resposta.
        Some("stream_event") => {
            let delta = &value["event"]["delta"];
            if delta.get("type").and_then(Value::as_str) != Some("text_delta") {
                return vec![];
            }
            match delta.get("text").and_then(Value::as_str) {
                Some(text) if !text.is_empty() => vec![ProviderEvent::TextDelta {
                    text: text.to_string(),
                }],
                _ => vec![],
            }
        }
        Some("assistant") => value["message"]["content"]
            .as_array()
            .map(|blocks| {
                blocks
                    .iter()
                    .filter(|b| b.get("type").and_then(Value::as_str) == Some("tool_use"))
                    .map(|b| ProviderEvent::ToolUse {
                        name: b["name"].as_str().unwrap_or("ferramenta").to_string(),
                        detail: tool_detail(&b["input"]),
                    })
                    .collect()
            })
            .unwrap_or_default(),
        Some("result") => {
            let is_error = value.get("is_error").and_then(Value::as_bool).unwrap_or(false);
            let mut events = Vec::new();
            if is_error {
                let message = value
                    .get("result")
                    .and_then(Value::as_str)
                    .unwrap_or("claude: execução terminou com erro")
                    .to_string();
                events.push(ProviderEvent::Error { message });
            }
            events.push(ProviderEvent::Done { ok: !is_error });
            events
        }
        _ => vec![],
    }
}

/// Resumo curto do que a ferramenta fez, para a linha de ferramenta no chat.
fn tool_detail(input: &Value) -> String {
    ["command", "file_path", "path", "pattern", "url", "description"]
        .iter()
        .find_map(|key| input.get(key).and_then(Value::as_str))
        .unwrap_or_default()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    const PARTIAL: &str = include_str!("../../tests/fixtures/claude_partial.jsonl");
    const TOOL: &str = include_str!("../../tests/fixtures/claude_tool.jsonl");

    fn events_of(fixture: &str) -> Vec<ProviderEvent> {
        fixture.lines().flat_map(parse_line).collect()
    }

    fn text_of(events: &[ProviderEvent]) -> String {
        events
            .iter()
            .filter_map(|e| match e {
                ProviderEvent::TextDelta { text } => Some(text.as_str()),
                _ => None,
            })
            .collect()
    }

    #[test]
    fn partial_capture_streams_text_and_finishes_ok() {
        let events = events_of(PARTIAL);

        assert!(matches!(
            events.first(),
            Some(ProviderEvent::SessionStarted { session_id }) if session_id == "a35297ea-77e7-4e26-8fda-ed4a29b80390"
        ));
        assert_eq!(text_of(&events), "ok");
        assert_eq!(events.last(), Some(&ProviderEvent::Done { ok: true }));
    }

    /// A mensagem `assistant` completa repete o texto que já chegou em deltas.
    /// Se o parser lesse os dois, a resposta apareceria duplicada.
    #[test]
    fn tool_capture_does_not_duplicate_text_and_reports_tool_use() {
        let events = events_of(TOOL);

        assert_eq!(text_of(&events), "feito");
        assert!(events.contains(&ProviderEvent::ToolUse {
            name: "Bash".into(),
            detail: "echo lunaharness".into(),
        }));
        assert_eq!(events.last(), Some(&ProviderEvent::Done { ok: true }));
    }

    #[test]
    fn invalid_json_becomes_readable_error() {
        let events = parse_line("isto não é json");
        assert!(matches!(&events[0], ProviderEvent::Error { message } if message.contains("não é JSON")));
    }

    #[test]
    fn error_result_emits_error_then_failed_done() {
        let line = r#"{"type":"result","is_error":true,"result":"limite excedido"}"#;
        assert_eq!(
            parse_line(line),
            vec![
                ProviderEvent::Error {
                    message: "limite excedido".into()
                },
                ProviderEvent::Done { ok: false },
            ]
        );
    }

    #[test]
    fn unknown_types_are_ignored() {
        assert!(parse_line(r#"{"type":"rate_limit_event"}"#).is_empty());
    }
}
