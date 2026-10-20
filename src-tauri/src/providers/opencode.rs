use serde_json::{json, Value};

use super::{AgentBrowser, Permission, ProviderEvent, RunRequest};

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
/// Orientação que vai junto do prompt quando o Playwright é o navegador. O OpenCode não expõe as ferramentas
/// do servidor como chamadas diretas: elas ficam no namespace `tools.playwright`, dentro da ferramenta `execute`.
const PLAYWRIGHT_NOTE: &str = "Navegador: use a ferramenta execute. As ferramentas do Playwright ficam no namespace tools.playwright; ache-as com search({ namespace: \"playwright\" }) e chame com await tools.playwright.<nome>({ ... }), por exemplo await tools.playwright.browser_navigate({ url: \"https://exemplo.com\" }). Não use o navegador embutido do Luna.";

/// Prompt que vai pelo stdin. Com o Playwright escolhido, a orientação vem antes da mensagem da pessoa.
pub fn prompt(request: &RunRequest) -> String {
    match request.browser {
        AgentBrowser::Playwright => format!("{PLAYWRIGHT_NOTE}\n\n{}", request.prompt),
        AgentBrowser::Builtin => request.prompt.clone(),
    }
}

/// Com o Playwright escolhido, o servidor entra na mesma config e as ferramentas dele ficam liberadas
/// (`playwright_*`), como o navegador embutido. Com o embutido, a config não tem `mcp`.
pub fn config_content(permission: Permission, browser: AgentBrowser) -> String {
    let mut rules = match permission {
        Permission::ReadOnly => json!({ "*": "deny", "read": "allow", "glob": "allow", "grep": "allow", "list": "allow", "execute": "allow" }),
        Permission::AcceptEdits => json!({ "*": "deny", "read": "allow", "glob": "allow", "grep": "allow", "list": "allow", "edit": "allow", "write": "allow", "patch": "allow", "execute": "allow" }),
        Permission::FullAccess => json!({ "*": "allow" }),
    };
    // O servidor de etapas vale em todos os modos: é o que alimenta o Progresso.
    let mut servers = json!({ crate::tasks_mcp::SERVER: { "type": "local", "command": crate::tasks_mcp::command(), "enabled": true } });
    if let Some(map) = rules.as_object_mut() {
        map.insert(format!("{}_*", crate::tasks_mcp::SERVER), json!("allow"));
    }
    if browser == AgentBrowser::Playwright {
        let (command, args) = crate::playwright::server_command();
        let mut command_line = vec![command];
        command_line.extend(args);
        servers["playwright"] = json!({ "type": "local", "command": command_line, "enabled": true });
        if let Some(map) = rules.as_object_mut() {
            map.insert("playwright_*".into(), json!("allow"));
        }
    }
    let mut config = json!({});
    config["mcp"] = servers;
    config["permission"] = rules;
    config.to_string()
}

/// Etapas que o agente registrou com o servidor lunatasks (`set_steps`), chamadas dentro do execute.
/// A lista sai no começo da chamada, para o Progresso acompanhar em tempo real. Outras chamadas não geram nada.
fn steps_event(value: &Value) -> Vec<ProviderEvent> {
    let part = &value["part"];
    if value.get("type").and_then(Value::as_str) != Some("tool_use") || part["tool"].as_str() != Some("execute") {
        return vec![];
    }
    part["state"]["input"]["code"]
        .as_str()
        .and_then(crate::tasks_mcp::steps_in_code)
        .map(|items| vec![ProviderEvent::Todos { items }])
        .unwrap_or_default()
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
    let mut events = steps_event(&value);
    events.extend(event_for(&value));
    events
}

/// Linha que vira evento de conversa (texto, ferramenta, erro). As etapas ficam em `steps_event`.
fn event_for(value: &Value) -> Vec<ProviderEvent> {
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
        // Erro da própria CLI (ex.: plano gratuito sem acesso): vira falha do turno, mesmo com saída 0.
        Some("error") => {
            let message = value["error"]["message"].as_str().unwrap_or("opencode: turno falhou sem mensagem");
            vec![
                ProviderEvent::Error { message: message.to_string() },
                ProviderEvent::Done { ok: false },
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

    /// Erro real da CLI (free tier sem acesso, capturado): falha do turno mesmo com saída 0.
    #[test]
    fn captured_cli_error_fails_the_turn() {
        const ERROR_RUN: &str = include_str!("../../tests/fixtures/opencode_error.jsonl");
        let events: Vec<ProviderEvent> = ERROR_RUN.lines().flat_map(parse_line).collect();

        assert!(events.iter().any(|e| matches!(e, ProviderEvent::Error { message } if message.contains("free tier"))));
        assert_eq!(events.last(), Some(&ProviderEvent::Done { ok: false }));
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
            browser: Default::default(),
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
        let config: Value = serde_json::from_str(&config_content(Permission::ReadOnly, AgentBrowser::Builtin)).unwrap();

        assert_eq!(config["permission"]["*"], "deny");
        assert_eq!(config["permission"]["read"], "allow");
        assert!(config["permission"].get("edit").is_none());
    }

    #[test]
    fn accept_edits_allows_file_edits_but_not_bash() {
        let config: Value = serde_json::from_str(&config_content(Permission::AcceptEdits, AgentBrowser::Builtin)).unwrap();

        assert_eq!(config["permission"]["edit"], "allow");
        assert_eq!(config["permission"]["write"], "allow");
        assert!(config["permission"].get("bash").is_none());
        assert_eq!(config["permission"]["*"], "deny");
    }

    /// O execute leva as ferramentas do Playwright e das etapas; sem ele, esses dois não funcionam nos modos de leitura e edição.
    #[test]
    fn execute_is_allowed_in_every_mode_without_bash() {
        for permission in [Permission::ReadOnly, Permission::AcceptEdits] {
            let config: Value = serde_json::from_str(&config_content(permission, AgentBrowser::Builtin)).unwrap();
            assert_eq!(config["permission"]["execute"], "allow");
            assert!(config["permission"].get("bash").is_none());
        }
    }

    #[test]
    fn full_access_allows_everything() {
        let config: Value = serde_json::from_str(&config_content(Permission::FullAccess, AgentBrowser::Builtin)).unwrap();

        assert_eq!(config["permission"]["*"], "allow");
    }

    /// Com o Playwright, a mensagem sai com a orientação de como achar as ferramentas; com o embutido, sai igual.
    #[test]
    fn prompt_names_the_playwright_namespace_only_when_chosen() {
        let mut req = request(None, None);
        assert_eq!(prompt(&req), "x");

        req.browser = AgentBrowser::Playwright;
        let text = prompt(&req);
        assert!(text.contains("tools.playwright"));
        assert!(text.ends_with("\n\nx"));
    }

    /// Captura real (OpenCode com o servidor lunatasks): cada chamada set_steps completa vira uma lista, na ordem.
    #[test]
    fn captured_steps_calls_become_the_checklist_in_order() {
        const STEPS: &str = include_str!("../../tests/fixtures/opencode_steps.jsonl");
        let lists: Vec<Vec<crate::providers::TodoItem>> = STEPS
            .lines()
            .flat_map(parse_line)
            .filter_map(|event| match event {
                ProviderEvent::Todos { items } => Some(items),
                _ => None,
            })
            .collect();
        assert_eq!(lists.len(), 4);
        assert_eq!(lists[0].iter().map(|t| t.status.as_str()).collect::<Vec<_>>(), ["pending", "pending"]);
        assert_eq!(lists[2][0].status, "completed");
        assert!(lists[3].iter().all(|t| t.status == "completed"));
    }

    /// O servidor de etapas entra em todos os modos, e a lista que o agente manda no execute vira o checklist.
    #[test]
    fn tasks_server_is_configured_in_every_mode_and_its_steps_become_todos() {
        for permission in [Permission::ReadOnly, Permission::AcceptEdits, Permission::FullAccess] {
            let config: Value = serde_json::from_str(&config_content(permission, AgentBrowser::Builtin)).unwrap();
            assert_eq!(config["mcp"]["lunatasks"]["enabled"], true);
            assert_eq!(config["mcp"]["lunatasks"]["command"][1], "tasks-mcp");
        }
        let line = r#"{"type":"tool_use","sessionID":"s","part":{"id":"p3","type":"tool","tool":"execute","state":{"status":"running","input":{"code":"await tools.lunatasks.set_steps({ steps: [{ content: \"Criar hello\", status: \"in_progress\" }] })"}}}}"#;
        let expected = crate::providers::TodoItem { content: "Criar hello".into(), status: "in_progress".into() };
        assert!(parse_line(line).contains(&ProviderEvent::Todos { items: vec![expected] }));
    }

    /// Com o Playwright, o servidor entra na config e as ferramentas dele ficam liberadas, mesmo no modo somente leitura.
    #[test]
    fn playwright_server_is_configured_and_allowed_only_when_chosen() {
        let with: Value = serde_json::from_str(&config_content(Permission::ReadOnly, AgentBrowser::Playwright)).unwrap();
        let server = &with["mcp"]["playwright"];
        assert_eq!(server["type"], "local");
        assert!(server["command"].as_array().unwrap().iter().any(|a| a == "@playwright/mcp@0.0.83"));
        assert_eq!(with["permission"]["playwright_*"], "allow");

        let without: Value = serde_json::from_str(&config_content(Permission::ReadOnly, AgentBrowser::Builtin)).unwrap();
        assert!(without["mcp"]["playwright"].is_null());
        assert!(without["permission"].get("playwright_*").is_none());
    }
}
