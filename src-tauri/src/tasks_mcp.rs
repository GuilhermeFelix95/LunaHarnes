//! Servidor MCP mínimo com as etapas da tarefa (`lunaharness tasks-mcp`), para o OpenCode e o Codex.
//! Uma ferramenta, `set_steps`: a lista inteira vale a cada chamada, então atualizar uma etapa é chamar de novo.
//! Quem mostra as etapas é o app, que lê a chamada na saída do CLI; este processo só confirma o recebimento.
use std::io::{BufRead, Write};

use serde_json::{json, Value};

use crate::providers::TodoItem;

/// Nome do servidor como o CLI o vê. Sem hífen: o OpenCode o expõe como `tools.lunatasks` dentro do execute.
pub const SERVER: &str = "lunatasks";
pub const TOOL: &str = "set_steps";
const STATUSES: [&str; 3] = ["pending", "in_progress", "completed"];

/// Lista de ferramentas que o agente vê.
pub fn tool_specs() -> Value {
    json!([{
        "name": TOOL,
        "description": "Define a lista inteira de etapas da tarefa atual, com o estado de cada uma. Chame de novo a cada mudança de estado.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "steps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "content": { "type": "string", "description": "Texto curto da etapa" },
                            "status": { "type": "string", "enum": STATUSES }
                        },
                        "required": ["content", "status"]
                    }
                }
            },
            "required": ["steps"]
        }
    }])
}

/// Lê as etapas dos argumentos. Recusa lista ausente, estado fora da lista e etapa sem texto.
pub fn parse_steps(args: &Value) -> Result<Vec<TodoItem>, String> {
    let steps = args["steps"].as_array().ok_or("steps precisa ser uma lista")?;
    steps
        .iter()
        .map(|step| {
            let content = step["content"].as_str().map(str::trim).filter(|c| !c.is_empty()).ok_or("cada etapa precisa de content")?;
            let status = step["status"].as_str().filter(|s| STATUSES.contains(s)).ok_or("status precisa ser pending, in_progress ou completed")?;
            Ok(TodoItem { content: content.to_string(), status: status.to_string() })
        })
        .collect()
}

/// Trata uma mensagem JSON-RPC. Devolve None para notificações (sem id).
pub fn handle_rpc(message: &Value) -> Option<Value> {
    let id = message.get("id")?.clone();
    let method = message["method"].as_str().unwrap_or_default();
    let result = match method {
        "initialize" => json!({
            "protocolVersion": "2024-11-05",
            "capabilities": { "tools": {} },
            "serverInfo": { "name": SERVER, "version": env!("CARGO_PKG_VERSION") }
        }),
        "tools/list" => json!({ "tools": tool_specs() }),
        "tools/call" => {
            let name = message["params"]["name"].as_str().unwrap_or_default();
            if name != TOOL {
                return Some(json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32602, "message": format!("ferramenta desconhecida: {name}") } }));
            }
            match parse_steps(&message["params"]["arguments"]) {
                Ok(steps) => json!({ "content": [{ "type": "text", "text": format!("{} etapas registradas", steps.len()) }], "isError": false }),
                Err(error) => json!({ "content": [{ "type": "text", "text": error }], "isError": true }),
            }
        }
        _ => return Some(json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32601, "message": format!("método não suportado: {method}") } })),
    };
    Some(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
}

/// Entrada do modo `tasks-mcp`: lê mensagens por stdin e responde por stdout.
pub fn mcp_stdio() -> i32 {
    let stdin = std::io::stdin();
    let mut stdout = std::io::stdout();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let message: Value = match serde_json::from_str(&line) {
            Ok(value) => value,
            Err(error) => {
                eprintln!("lunatasks: mensagem inválida: {error}");
                continue;
            }
        };
        if let Some(reply) = handle_rpc(&message) {
            if writeln!(stdout, "{reply}").and_then(|_| stdout.flush()).is_err() {
                break;
            }
        }
    }
    0
}

/// Comando que o CLI executa para subir o servidor: o próprio app, no modo `tasks-mcp`.
/// Barras normais no caminho: o Codex lê o valor como TOML, onde a barra invertida é escape.
pub fn command() -> Vec<String> {
    let exe = std::env::current_exe().map(|path| path.display().to_string().replace('\\', "/")).unwrap_or_else(|_| "lunaharness".into());
    vec![exe, "tasks-mcp".into()]
}

/// Etapas de uma chamada `set_steps` no código do execute do OpenCode. O código é JavaScript:
/// o objeto de argumentos vem logo depois do parêntese, com chaves sem aspas, então ele passa por `quote_keys`.
pub fn steps_in_code(code: &str) -> Option<Vec<TodoItem>> {
    let marker = format!("tools.{SERVER}.{TOOL}(");
    let start = code.find(&marker)? + marker.len();
    let json = quote_keys(code[start..].trim_start());
    let args = serde_json::Deserializer::from_str(&json).into_iter::<Value>().next()?.ok()?;
    parse_steps(&args).ok()
}

/// Põe aspas nas chaves de um objeto JavaScript (`{ steps: [...] }` vira `{ "steps": [...] }`), fora das strings.
fn quote_keys(js: &str) -> String {
    let chars: Vec<char> = js.chars().collect();
    let mut out = String::with_capacity(js.len() + 16);
    let mut i = 0;
    let mut in_string: Option<char> = None;
    let mut after_open = false;
    while i < chars.len() {
        let c = chars[i];
        if let Some(quote) = in_string {
            // Dentro de uma string: copia como está. Aspas simples viram aspas duplas, para o JSON.
            if c == '\\' && i + 1 < chars.len() {
                out.push(c);
                out.push(chars[i + 1]);
                i += 2;
                continue;
            }
            if c == quote {
                in_string = None;
                out.push('"');
            } else if quote == '\'' && c == '"' {
                out.push_str("\\\"");
            } else {
                out.push(c);
            }
            i += 1;
            continue;
        }
        if c == '"' || c == '\'' {
            in_string = Some(c);
            out.push('"');
            i += 1;
            after_open = false;
            continue;
        }
        if c == '{' || c == ',' {
            after_open = true;
            out.push(c);
            i += 1;
            continue;
        }
        if after_open && (c.is_ascii_alphabetic() || c == '_') {
            let mut end = i;
            while end < chars.len() && (chars[end].is_ascii_alphanumeric() || chars[end] == '_') {
                end += 1;
            }
            let mut after = end;
            while after < chars.len() && chars[after].is_whitespace() {
                after += 1;
            }
            if after < chars.len() && chars[after] == ':' {
                out.push('"');
                out.extend(&chars[i..end]);
                out.push('"');
                i = end;
                after_open = false;
                continue;
            }
        }
        // JavaScript aceita vírgula antes de fechar a lista ou o objeto; JSON não.
        if c == ']' || c == '}' {
            if let Some(at) = out.rfind(|ch: char| !ch.is_whitespace()) {
                if out[at..].starts_with(',') {
                    out.remove(at);
                }
            }
        }
        if !c.is_whitespace() {
            after_open = false;
        }
        out.push(c);
        i += 1;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn call(args: Value) -> Value {
        handle_rpc(&json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": { "name": TOOL, "arguments": args } })).unwrap()
    }

    #[test]
    fn lists_one_tool_with_steps_and_the_three_states() {
        let listed = handle_rpc(&json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list" })).unwrap();
        let tools = listed["result"]["tools"].as_array().unwrap();
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0]["name"], TOOL);
        assert_eq!(tools[0]["inputSchema"]["required"], json!(["steps"]));
        assert_eq!(tools[0]["inputSchema"]["properties"]["steps"]["items"]["properties"]["status"]["enum"], json!(STATUSES));
    }

    #[test]
    fn a_valid_list_is_confirmed_with_its_size() {
        let reply = call(json!({ "steps": [{ "content": "Criar hello.txt", "status": "completed" }, { "content": "Criar bye.txt", "status": "in_progress" }] }));
        assert_eq!(reply["result"]["isError"], false);
        assert_eq!(reply["result"]["content"][0]["text"], "2 etapas registradas");
    }

    #[test]
    fn an_unknown_status_or_missing_steps_is_an_error_not_a_crash() {
        assert_eq!(call(json!({ "steps": [{ "content": "x", "status": "feito" }] }))["result"]["isError"], true);
        assert_eq!(call(json!({}))["result"]["isError"], true);
        assert_eq!(call(json!({ "steps": [{ "content": "  ", "status": "pending" }] }))["result"]["isError"], true);
    }

    #[test]
    fn other_tools_are_refused() {
        let reply = handle_rpc(&json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": { "name": "apagar", "arguments": {} } })).unwrap();
        assert_eq!(reply["error"]["code"], -32602);
    }

    #[test]
    fn steps_are_read_from_the_opencode_code_with_bare_keys_and_quotes() {
        let code = r#"const r = await tools.lunatasks.set_steps({ steps: [{ content: "Criar hello.txt", status: "completed" }, { content: 'Criar bye.txt', status: "in_progress" }] });
return r;"#;
        let steps = steps_in_code(code).unwrap();
        assert_eq!(steps.len(), 2);
        assert_eq!(steps[1], TodoItem { content: "Criar bye.txt".into(), status: "in_progress".into() });
    }

    #[test]
    fn steps_in_code_accepts_strict_json_too() {
        let code = r#"await tools.lunatasks.set_steps({"steps":[{"content":"Só uma","status":"pending"}]})"#;
        assert_eq!(steps_in_code(code).unwrap()[0].content, "Só uma");
    }

    #[test]
    fn code_without_the_call_or_with_a_bad_status_gives_no_steps() {
        assert!(steps_in_code("await tools.playwright.browser_navigate({ url: 'x' })").is_none());
        assert!(steps_in_code(r#"await tools.lunatasks.set_steps({ steps: [{ content: "x", status: "feito" }] })"#).is_none());
    }

    #[test]
    fn command_runs_this_app_in_tasks_mcp_mode_with_forward_slashes() {
        let command = command();
        assert_eq!(command[1], "tasks-mcp");
        assert!(!command[0].contains('\\'));
    }

    #[test]
    fn parse_steps_keeps_order_and_trims_content() {
        let steps = parse_steps(&json!({ "steps": [{ "content": " A ", "status": "pending" }, { "content": "B", "status": "completed" }] })).unwrap();
        assert_eq!(steps, vec![TodoItem { content: "A".into(), status: "pending".into() }, TodoItem { content: "B".into(), status: "completed".into() }]);
    }
}
