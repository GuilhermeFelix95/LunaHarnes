use serde_json::Value;

use super::ProviderEvent;

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
}
