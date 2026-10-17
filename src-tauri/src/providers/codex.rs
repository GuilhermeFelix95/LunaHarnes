use serde_json::Value;

use super::ProviderEvent;

use super::{Permission, RunRequest};

/// `codex exec --json -` lê o prompt do stdin e emite JSONL.
/// `exec resume` não aceita `-s`, então a retomada passa o sandbox por `-c sandbox_mode`.
pub fn args(request: &RunRequest) -> Vec<String> {
    let sandbox = sandbox_mode(request.permission);
    let mut args: Vec<String> = vec!["exec".into()];
    // Uma flag `-i` por imagem, sempre antes de `--json`: assim o `-` do stdin nunca vira valor de imagem.
    let images: Vec<String> = request
        .images
        .iter()
        .flat_map(|p| ["-i".to_string(), p.display().to_string()])
        .collect();

    // `-s` só existe em `exec` novo; a retomada recebe o mesmo modo por `-c sandbox_mode`.
    match &request.session_id {
        None => {
            args.extend(images.iter().cloned());
            args.extend(["--json", "--skip-git-repo-check", "-s", sandbox].map(String::from));
        }
        Some(_) => args.extend(["-c".to_string(), format!("sandbox_mode=\"{sandbox}\"")]),
    }

    if let Some(model) = &request.model {
        args.extend(["-m".to_string(), model.clone()]);
    }
    if let Some(effort) = &request.effort {
        args.extend(["-c".to_string(), format!("model_reasoning_effort=\"{effort}\"")]);
    }

    match &request.session_id {
        None => args.push("-".into()),
        Some(id) => {
            args.extend(["resume".to_string(), id.clone()]);
            args.extend(images.iter().cloned());
            args.extend(["--json".to_string(), "--skip-git-repo-check".into(), "-".into()]);
        }
    }
    args
}

fn sandbox_mode(permission: Permission) -> &'static str {
    match permission {
        Permission::ReadOnly => "read-only",
        Permission::AcceptEdits => "workspace-write",
        Permission::FullAccess => "danger-full-access",
    }
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
            match item.get("type").and_then(Value::as_str) {
                Some("agent_message") => item
                    .get("text")
                    .and_then(Value::as_str)
                    .map(|text| {
                        vec![ProviderEvent::TextDelta {
                            text: text.to_string(),
                        }]
                    })
                    .unwrap_or_default(),
                Some("command_execution") => vec![ProviderEvent::ToolUse {
                    name: "Bash".into(),
                    detail: item["command"].as_str().unwrap_or_default().to_string(),
                }],
                Some("file_change") => {
                    let paths: Vec<&str> = item["changes"]
                        .as_array()
                        .map(|changes| {
                            changes
                                .iter()
                                .filter_map(|c| c.get("path").and_then(Value::as_str))
                                .collect()
                        })
                        .unwrap_or_default();
                    vec![ProviderEvent::ToolUse {
                        name: "Editar".into(),
                        detail: paths.join(", "),
                    }]
                }
                _ => vec![],
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

    /// Formato documentado do `codex exec --json`. Ainda não validado com captura real,
    /// porque o Codex desta máquina não está logado; validar no smoke test.
    #[test]
    fn command_execution_becomes_bash_tool_use() {
        let line = r#"{"type":"item.completed","item":{"id":"item_2","type":"command_execution","command":"dir","status":"completed"}}"#;
        assert_eq!(
            parse_line(line),
            vec![ProviderEvent::ToolUse {
                name: "Bash".into(),
                detail: "dir".into()
            }]
        );
    }

    #[test]
    fn file_change_lists_changed_paths() {
        let line = r#"{"type":"item.completed","item":{"id":"item_3","type":"file_change","changes":[{"path":"a.ts","kind":"update"},{"path":"b.ts","kind":"add"}]}}"#;
        assert_eq!(
            parse_line(line),
            vec![ProviderEvent::ToolUse {
                name: "Editar".into(),
                detail: "a.ts, b.ts".into()
            }]
        );
    }

    #[test]
    fn turn_completed_is_success() {
        assert_eq!(
            parse_line(r#"{"type":"turn.completed","usage":{}}"#),
            vec![ProviderEvent::Done { ok: true }]
        );
    }

    /// Cada imagem ganha a sua flag \`-i\`, antes de \`--json\`; o \`-\` do stdin fica por último.
    #[test]
    fn each_image_gets_its_own_flag_before_the_stdin_marker() {
        let request = RunRequest {
            provider: crate::providers::ProviderKind::Codex,
            prompt: "x".into(),
            session_id: None,
            cwd: std::path::PathBuf::from("C:\\projeto"),
            permission: Permission::ReadOnly,
            model: None,
            effort: None,
            profile: None,
            images: vec![
                std::path::PathBuf::from("C:\\a\\1.png"),
                std::path::PathBuf::from("C:\\a\\2.jpg"),
            ],
        };
        let flags = args(&request);
        let first = flags.iter().position(|a| a == "-i").unwrap();
        assert_eq!(flags[first + 1], "C:\\a\\1.png");
        assert_eq!(flags.iter().filter(|a| *a == "-i").count(), 2);
        assert!(first < flags.iter().position(|a| a == "--json").unwrap());
        assert_eq!(flags.last().unwrap(), "-");
    }
}
