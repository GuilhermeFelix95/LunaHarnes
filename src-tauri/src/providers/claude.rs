use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};

use super::{ProviderEvent, TodoItem};

use super::{identity_for, image_media_type, LimitWindow, Permission, RunRequest};

/// Sem isso, o Claude Code oferece as ferramentas de tarefa só para alguns modelos; com esta variável elas ficam ligadas.
/// Confirmado numa execução real: com ela, o agente cria e atualiza tarefas (TaskCreate / TaskUpdate).
pub fn task_env() -> (String, String) {
    ("CLAUDE_CODE_ENABLE_TODO_TOOLS".to_string(), "true".to_string())
}

/// Em tarefas com etapas, o agente registra cada etapa e atualiza o estado ao avançar: é o que alimenta a aba Progresso.
const TASK_INSTRUCTION: &str = "Em tarefas com mais de uma etapa, registre as etapas com a ferramenta de tarefas (TaskCreate) antes de começar e atualize o estado de cada uma (TaskUpdate) ao avançar.";

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
    // Uma linha só: quebra de linha num argumento quebra o .cmd do Windows.
    args.extend(["--append-system-prompt".to_string(), format!("{} {TASK_INSTRUCTION}", identity_for(request))]);
    // Deixa o agente ler o guia de plugins, e só essa pasta. Sempre seguido de uma flag, pois --add-dir aceita vários valores.
    if let Some(dir) = crate::plugins::guide::dir() {
        args.extend(["--add-dir".to_string(), dir.display().to_string()]);
    }
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
                    .flat_map(tool_use_events)
                    .collect()
            })
            .unwrap_or_default(),
        // O resultado de TaskCreate traz o id da tarefa; ele liga o tool_use_id ao id que o TaskUpdate usa.
        Some("user") => task_assigned_events(&value),
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
    // A janela pode faltar (API de terceiros): o evento sai mesmo assim, com window_size vazio.
    let window_size = value["modelUsage"]
        .as_object()
        .and_then(|models| models.values().next())
        .and_then(|model| model["contextWindow"].as_u64());

    let usage = &value["usage"];
    if usage.is_null() {
        return None;
    }
    let last = usage["iterations"].as_array().and_then(|list| list.last()).unwrap_or(usage);
    let tokens = ["input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"]
        .iter()
        .map(|key| last[*key].as_u64().unwrap_or(0))
        .sum();

    Some(ProviderEvent::Context { tokens, window_size })
}

/// Linha de ferramenta e, quando a ferramenta mexe no checklist, o evento de tarefa correspondente.
fn tool_use_events(block: &Value) -> Vec<ProviderEvent> {
    let name = block["name"].as_str().unwrap_or("ferramenta").to_string();
    let input = &block["input"];
    let mut events = vec![ProviderEvent::ToolUse { name: name.clone(), detail: tool_detail(input) }];
    match name.as_str() {
        "TodoWrite" => events.extend(todos_event(input)),
        "TaskCreate" => events.push(ProviderEvent::TaskCreated {
            key: block["id"].as_str().unwrap_or_default().to_string(),
            subject: input["subject"].as_str().unwrap_or_default().to_string(),
        }),
        "TaskUpdate" => events.push(ProviderEvent::TaskUpdated {
            id: input["taskId"].as_str().unwrap_or_default().to_string(),
            status: input["status"].as_str().map(str::to_string),
            subject: input["subject"].as_str().map(str::to_string),
        }),
        _ => {}
    }
    events
}

/// Resultado de TaskCreate: `tool_use_result.task.id` é o id da tarefa e `tool_use_id` liga ao TaskCreate.
fn task_assigned_events(value: &Value) -> Vec<ProviderEvent> {
    let Some(id) = value["tool_use_result"]["task"]["id"].as_str() else {
        return vec![];
    };
    value["message"]["content"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|b| b.get("type").and_then(Value::as_str) == Some("tool_result"))
        .filter_map(|b| b["tool_use_id"].as_str())
        .map(|key| ProviderEvent::TaskAssigned { key: key.to_string(), id: id.to_string() })
        .collect()
}

/// Lista de etapas da ferramenta TodoWrite. Etapa sem texto ou sem status vira "" ou "pending".
fn todos_event(input: &Value) -> Option<ProviderEvent> {
    let items = input["todos"]
        .as_array()?
        .iter()
        .map(|todo| TodoItem {
            content: todo["content"].as_str().unwrap_or_default().to_string(),
            status: todo["status"].as_str().unwrap_or("pending").to_string(),
        })
        .collect();
    Some(ProviderEvent::Todos { items })
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
    use crate::providers::{ProviderKind, LUNA_IDENTITY};

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
            context_window: None,
            images: Vec::new(),
        };

        let args = args(&request);

        assert!(args.windows(2).any(|w| w[0] == "--append-system-prompt" && w[1].starts_with(LUNA_IDENTITY) && w[1].contains("TaskCreate")));
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
            window_size: Some(1_000_000),
        }));
    }

    /// No Windows, `claude` é um .cmd: quebra de linha ou aspas em argumento faz o cmd recusar a chamada
    /// ("batch file arguments are invalid"). Nenhum argumento pode ter esses caracteres.
    #[test]
    fn no_argument_has_line_breaks_or_quotes_that_break_the_cmd_shim() {
        let request = RunRequest {
            provider: ProviderKind::Claude,
            prompt: "oi".into(),
            session_id: None,
            cwd: ".".into(),
            permission: Permission::AcceptEdits,
            model: None,
            effort: None,
            profile: None,
            context_window: None,
            images: vec![],
        };

        for arg in args(&request) {
            assert!(!arg.contains(['\n', '\r', '"', '%']), "argumento inválido para o .cmd: {arg:?}");
        }
    }

    /// O Claude Code atual cria tarefas com TaskCreate e atualiza com TaskUpdate (formato medido numa execução real).
    #[test]
    fn task_create_and_update_become_task_events() {
        let create = parse_line(
            r#"{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_1","name":"TaskCreate","input":{"subject":"Criar hello.txt","description":"d","activeForm":"Criando"}}]}}"#,
        );
        let update = parse_line(
            r#"{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_2","name":"TaskUpdate","input":{"taskId":"1","status":"completed"}}]}}"#,
        );

        assert!(create.contains(&ProviderEvent::TaskCreated { key: "toolu_1".into(), subject: "Criar hello.txt".into() }));
        assert!(update.contains(&ProviderEvent::TaskUpdated { id: "1".into(), status: Some("completed".into()), subject: None }));
    }

    /// O id da tarefa só volta no resultado da ferramenta (mensagem `user`), ligado ao tool_use_id.
    #[test]
    fn the_task_id_comes_back_in_the_tool_result() {
        let events = parse_line(
            r#"{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"Task #1 created"}]},"tool_use_result":{"task":{"id":"1","subject":"Criar hello.txt"}}}"#,
        );

        assert_eq!(events, vec![ProviderEvent::TaskAssigned { key: "toolu_1".into(), id: "1".into() }]);
    }

    /// TodoWrite vira o checklist da aba Progresso, na ordem que o agente escreveu.
    #[test]
    fn todo_write_becomes_an_ordered_checklist_and_keeps_the_tool_line() {
        let events = parse_line(
            r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"TodoWrite","input":{"todos":[{"content":"Criar tela","status":"completed","activeForm":"Criando tela"},{"content":"Ligar a API","status":"in_progress"}]}}]}}"#,
        );

        assert_eq!(events[0], ProviderEvent::ToolUse { name: "TodoWrite".into(), detail: String::new() });
        assert_eq!(
            events[1],
            ProviderEvent::Todos {
                items: vec![
                    TodoItem { content: "Criar tela".into(), status: "completed".into() },
                    TodoItem { content: "Ligar a API".into(), status: "in_progress".into() },
                ],
            }
        );
    }

    /// Endpoints de API (OpenRouter) não trazem a janela no resultado: os tokens ainda valem para o medidor.
    #[test]
    fn context_is_reported_even_when_the_window_size_is_unknown() {
        let value = serde_json::json!({
            "modelUsage": { "nvidia/nemotron-3.5-super-vl": {} },
            "usage": { "input_tokens": 1200, "cache_read_input_tokens": 300, "cache_creation_input_tokens": 0 }
        });

        assert_eq!(
            context_event(&value),
            Some(ProviderEvent::Context { tokens: 1500, window_size: None })
        );
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
            context_window: None,
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
            context_window: None,
            images: Vec::new(),
        };
        assert_eq!(input(&request).unwrap(), "oi");
        assert!(!args(&request).iter().any(|a| a == "--input-format"));
    }
}
