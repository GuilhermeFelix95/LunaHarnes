use serde_json::Value;

use super::ProviderEvent;

/// `codex exec --json -` lê o prompt do stdin e emite JSONL.
pub fn args() -> Vec<String> {
    ["exec", "--json", "--skip-git-repo-check", "-"]
        .iter()
        .map(|s| s.to_string())
        .collect()
}

/// Eventos `error` de nível superior são avisos de reconexão do próprio Codex,
/// então são ignorados. Falha real chega em `turn.failed`.
pub fn parse_line(line: &str) -> Vec<ProviderEvent> {
    let value: Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => {
            return vec![ProviderEvent::Error {
                message: "codex: linha de saída não é JSON válido".into(),
            }]
        }
    };

    match value.get("type").and_then(Value::as_str) {
        Some("thread.started") => match value.get("thread_id").and_then(Value::as_str) {
            Some(id) => vec![ProviderEvent::SessionStarted {
                session_id: id.to_string(),
            }],
            None => vec![],
        },
        Some("item.completed") => {
            let item = &value["item"];
            if item.get("type").and_then(Value::as_str) == Some("agent_message") {
                item.get("text")
                    .and_then(Value::as_str)
                    .map(|text| {
                        vec![ProviderEvent::TextDelta {
                            text: text.to_string(),
                        }]
                    })
                    .unwrap_or_default()
            } else {
                vec![]
            }
        }
        Some("turn.completed") => vec![ProviderEvent::Done { ok: true }],
        Some("turn.failed") => {
            let message = value["error"]["message"]
                .as_str()
                .unwrap_or("codex: turno falhou sem mensagem")
                .to_string();
            vec![
                ProviderEvent::Error { message },
                ProviderEvent::Done { ok: false },
            ]
        }
        _ => vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FAILED_TURN: &str = include_str!("../../tests/fixtures/codex_stream.jsonl");

    #[test]
    fn captured_unauthenticated_run_reports_failure_once() {
        let events: Vec<ProviderEvent> = FAILED_TURN.lines().flat_map(parse_line).collect();

        assert!(matches!(events.first(), Some(ProviderEvent::SessionStarted { .. })));
        // Apenas o turn.failed vira erro; os avisos "Reconnecting..." são ignorados.
        let errors = events
            .iter()
            .filter(|e| matches!(e, ProviderEvent::Error { .. }))
            .count();
        assert_eq!(errors, 1);
        assert_eq!(events.last(), Some(&ProviderEvent::Done { ok: false }));
    }

    #[test]
    fn agent_message_becomes_text() {
        let line = r#"{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"ok"}}"#;
        assert_eq!(
            parse_line(line),
            vec![ProviderEvent::TextDelta { text: "ok".into() }]
        );
    }

    #[test]
    fn turn_completed_is_success() {
        assert_eq!(
            parse_line(r#"{"type":"turn.completed","usage":{}}"#),
            vec![ProviderEvent::Done { ok: true }]
        );
    }
}
