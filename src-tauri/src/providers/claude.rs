use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};

use super::ProviderEvent;

use super::{image_media_type, LimitWindow, Permission, RunRequest, LUNA_IDENTITY};

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
    if !request.images.is_empty() {
        args.extend(["--input-format".to_string(), "stream-json".to_string()]);
    }

    // Acrescenta a identidade ao prompt padrão, que diz que o agente é o Claude Code.
    args.extend(["--append-system-prompt".to_string(), LUNA_IDENTITY.to_string()]);
    if let Some(model) = &request.model {
        args.extend(["--model".to_string(), model.clone()]);
    }
    if let Some(effort) = &request.effort {
        args.extend(["--effort".to_string(), effort.clone()]);
    }
    if let Some(id) = &request.session_id {
        args.push("--resume".into());
        args.push(id.clone());
    }
    args
}

/// Entrada do CLI pelo stdin. Sem imagens é o prompt puro. Com imagens, uma linha stream-json:
/// o texto e um bloco de imagem em base64 para cada arquivo.
pub fn input(request: &RunRequest) -> Result<String, String> {
    if request.images.is_empty() {
        return Ok(request.prompt.clone());
    }
    let mut content = vec![json!({ "type": "text", "text": request.prompt })];
    for path in &request.images {
        let media_type = image_media_type(path).ok_or("formato de imagem não suportado")?;
        let bytes = std::fs::read(path)
            .map_err(|e| format!("não foi possível ler a imagem {}: {e}", path.display()))?;
        content.push(json!({
            "type": "image",
            "source": { "type": "base64", "media_type": media_type, "data": STANDARD.encode(bytes) }
        }));
    }
    let line = json!({ "type": "user", "message": { "role": "user", "content": content } });
    Ok(format!("{line}\n"))
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
        Some("rate_limit_event") => rate_limit_events(&value),
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
            events.extend(context_event(&value));
            // Com API, a CLI informa o custo do turno. Com assinatura, o campo não vem.
            if let Some(usd) = value.get("total_cost_usd").and_then(Value::as_f64) {
                events.push(ProviderEvent::Cost { usd });
            }
            events.push(ProviderEvent::Done { ok: !is_error });
            events
        }
        _ => vec![],
    }
}

/// `rate_limit_event` traz as duas janelas em `unifiedWindows`. Cada uma vira um evento.
fn rate_limit_events(value: &Value) -> Vec<ProviderEvent> {
    let windows = &value["rate_limit_info"]["unifiedWindows"];
    [("five_hour", LimitWindow::FiveHour), ("seven_day", LimitWindow::SevenDay)]
        .into_iter()
        .filter_map(|(key, window)| {
            let info = windows.get(key)?;
            Some(ProviderEvent::RateLimit {
                window,
                utilization: info["utilization"].as_f64()?,
                resets_at: info["resetsAt"].as_i64()?,
            })
        })
        .collect()
}

/// No fim do turno, `modelUsage` dá o tamanho da janela e `usage` diz quantos tokens entraram.
/// Os tokens que contam para o contexto são os da última chamada ao modelo.
fn context_event(value: &Value) -> Option<ProviderEvent> {
    let (_, model) = value["modelUsage"].as_object()?.iter().next()?;
    let window_size = model["contextWindow"].as_u64()?;

    let usage = &value["usage"];
    let last = usage["iterations"].as_array().and_then(|list| list.last()).unwrap_or(usage);
    let tokens = ["input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"]
        .iter()
        .map(|key| last[*key].as_u64().unwrap_or(0))
        .sum();

    Some(ProviderEvent::Context { tokens, window_size })
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

    /// A identidade vai junto de cada pedido, acrescentada ao prompt padrão (nunca substitui).
    #[test]
    fn identity_is_appended_to_the_default_prompt_on_every_run() {
        let request = RunRequest {
            provider: crate::providers::ProviderKind::Claude,
            prompt: "x".into(),
            session_id: Some("sess-1".into()),
            cwd: std::path::PathBuf::from("C:\\projeto"),
            permission: Permission::AcceptEdits,
            model: Some("deepseek-flash".into()),
            effort: None,
            profile: Some("p1".into()),
            images: Vec::new(),
        };

        let args = args(&request);

        assert!(args.windows(2).any(|w| w[0] == "--append-system-prompt" && w[1] == LUNA_IDENTITY));
        assert!(!args.iter().any(|a| a == "--system-prompt"));
    }

    const PARTIAL: &str = include_str!("../../tests/fixtures/claude_partial.jsonl");
    const TOOL: &str = include_str!("../../tests/fixtures/claude_tool.jsonl");
    const USAGE: &str = include_str!("../../tests/fixtures/claude_usage.jsonl");

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

    /// Captura real: uma execução curta mostra as janelas de 5 horas e semana e o contexto do turno.
    #[test]
    fn real_capture_reports_both_limit_windows_and_context() {
        let events = events_of(USAGE);

        let limit = |want: LimitWindow| {
            events.iter().find_map(|e| match e {
                ProviderEvent::RateLimit { window, utilization, resets_at } if *window == want => {
                    Some((*utilization, *resets_at))
                }
                _ => None,
            })
        };
        let (five, five_reset) = limit(LimitWindow::FiveHour).expect("janela de 5 horas");
        let (week, week_reset) = limit(LimitWindow::SevenDay).expect("janela semanal");

        assert!((five - 0.45).abs() < 1e-9);
        assert_eq!(five_reset, 1792266000);
        assert!((week - 0.35).abs() < 1e-9);
        assert_eq!(week_reset, 1792512000);

        // input 2 + cache de leitura 26559 + cache de criação 17499.
        assert!(events.contains(&ProviderEvent::Context {
            tokens: 44060,
            window_size: 1_000_000,
        }));
    }

    #[test]
    fn unknown_types_are_ignored() {
        assert!(parse_line(r#"{"type":"tool_use_summary"}"#).is_empty());
    }

    #[test]
    fn images_switch_input_to_stream_json_with_one_block_per_image() {
        let dir = std::env::temp_dir().join(format!("lunaharness-claude-img-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("foto.png");
        std::fs::write(&path, [0x89u8, b'P', b'N', b'G']).unwrap();
        let request = RunRequest {
            provider: crate::providers::ProviderKind::Claude,
            prompt: "o que tem na imagem?".into(),
            session_id: None,
            cwd: std::path::PathBuf::from("C:\\projeto"),
            permission: Permission::ReadOnly,
            model: None,
            effort: None,
            profile: None,
            images: vec![path.clone()],
        };

        let flags = args(&request);
        assert!(flags.windows(2).any(|w| w == ["--input-format", "stream-json"]));

        let line = input(&request).unwrap();
        let value: serde_json::Value = serde_json::from_str(line.trim()).unwrap();
        let content = &value["message"]["content"];
        assert_eq!(content[0]["text"], "o que tem na imagem?");
        assert_eq!(content[1]["type"], "image");
        assert_eq!(content[1]["source"]["media_type"], "image/png");
        let data = STANDARD.decode(content[1]["source"]["data"].as_str().unwrap()).unwrap();
        assert_eq!(data, vec![0x89u8, b'P', b'N', b'G']);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn without_images_the_prompt_goes_to_stdin_as_it_is() {
        let request = RunRequest {
            provider: crate::providers::ProviderKind::Claude,
            prompt: "oi".into(),
            session_id: None,
            cwd: std::path::PathBuf::from("C:\\projeto"),
            permission: Permission::ReadOnly,
            model: None,
            effort: None,
            profile: None,
            images: Vec::new(),
        };
        assert_eq!(input(&request).unwrap(), "oi");
        assert!(!args(&request).iter().any(|a| a == "--input-format"));
    }
}
