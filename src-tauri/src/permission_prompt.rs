//! Pedido de permissão do Claude (`--permission-prompt-tool`). Antes de uma ação que precisa de confirmação,
//! o CLI chama a ferramenta `approve` deste servidor MCP (`lunacode permission-mcp`). Esse processo encaminha
//! o pedido ao app por HTTP local com token; o app mostra o pedido no chat e responde allow ou deny
//! conforme a escolha da pessoa. Sem resposta em dez minutos, o pedido é negado.
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Mutex, OnceLock};
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

/// Nome do servidor como o CLI o vê. A ferramenta vira `mcp__luna-perm__approve`.
pub const SERVER: &str = "luna-perm";
pub const TOOL: &str = "approve";
/// Nome completo que o `--permission-prompt-tool` recebe.
pub const PROMPT_TOOL: &str = "mcp__luna-perm__approve";
/// Evento com o pedido, lido pelo chat da conversa que roda o turno.
pub const REQUEST_EVENT: &str = "permission-request";
const WAIT: Duration = Duration::from_secs(600);
const MAX_BODY: usize = 256 * 1024;

static APP: OnceLock<AppHandle> = OnceLock::new();
static TOKEN: OnceLock<String> = OnceLock::new();
static CONFIG: OnceLock<PathBuf> = OnceLock::new();
static COUNTER: AtomicU64 = AtomicU64::new(0);

type Pending = Mutex<HashMap<String, mpsc::Sender<Decision>>>;

fn pending() -> &'static Pending {
    static PENDING: OnceLock<Pending> = OnceLock::new();
    PENDING.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Resposta da pessoa: permitir ou negar, com o motivo que volta ao agente quando nega.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Decision {
    pub allow: bool,
    pub message: Option<String>,
}

/// Pedido que o app mostra no chat.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PermissionRequest {
    pub id: String,
    pub run_id: String,
    pub tool_name: String,
    pub input: Value,
    pub tool_use_id: String,
}

/// Formato de decisão que o Claude Code espera da ferramenta de permissão.
pub fn decision_json(decision: &Decision, input: &Value) -> Value {
    if decision.allow {
        json!({ "behavior": "allow", "updatedInput": input })
    } else {
        json!({ "behavior": "deny", "message": decision.message.clone().unwrap_or_else(|| "negado pela pessoa no app".into()) })
    }
}

/// Lista de ferramentas que o CLI vê.
pub fn tool_specs() -> Value {
    json!([{
        "name": TOOL,
        "description": "Pede permissão da pessoa para uma ação que precisa de confirmação.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tool_name": { "type": "string" },
                "input": { "type": "object" },
                "tool_use_id": { "type": "string" }
            },
            "required": ["tool_name", "input"]
        }
    }])
}

/// Trata uma mensagem JSON-RPC do CLI. `ask` encaminha o pedido ao app e devolve a decisão.
/// Devolve None para notificações (sem id).
pub fn handle_rpc(message: &Value, run_id: &str, ask: &mut dyn FnMut(&Value) -> Result<Value, String>) -> Option<Value> {
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
            let args = &message["params"]["arguments"];
            // Qualquer falha vira negação: sem resposta da pessoa, a ação não roda.
            let decision = match ask(&json!({ "runId": run_id, "toolName": args["tool_name"], "input": args["input"], "toolUseId": args["tool_use_id"] })) {
                Ok(decision) => decision,
                Err(error) => json!({ "behavior": "deny", "message": error }),
            };
            json!({ "content": [{ "type": "text", "text": decision.to_string() }], "isError": false })
        }
        _ => return Some(json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32601, "message": format!("método não suportado: {method}") } })),
    };
    Some(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
}

/// Entrada do modo `permission-mcp`: lê mensagens por stdin e responde por stdout.
pub fn mcp_stdio() -> i32 {
    let url = std::env::var("LUNA_PERM_URL").unwrap_or_default();
    let token = std::env::var("LUNA_PERM_TOKEN").unwrap_or_default();
    let run_id = std::env::var("LUNA_RUN_ID").unwrap_or_default();
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
                eprintln!("luna-perm: mensagem inválida: {error}");
                continue;
            }
        };
        let mut ask = |request: &Value| forward(&url, &token, request);
        if let Some(reply) = handle_rpc(&message, &run_id, &mut ask) {
            if writeln!(stdout, "{reply}").and_then(|_| stdout.flush()).is_err() {
                break;
            }
        }
    }
    0
}

/// Envia o pedido ao app e espera a decisão. Erro de conexão ou de token vira erro (o chamador nega).
fn forward(url: &str, token: &str, request: &Value) -> Result<Value, String> {
    let body = request.to_string();
    let (address, path) = parse_url(url)?;
    let mut stream = TcpStream::connect(&address).map_err(|e| format!("app não respondeu: {e}"))?;
    stream.set_read_timeout(Some(WAIT + Duration::from_secs(5))).ok();
    let head = format!(
        "POST {path} HTTP/1.1\r\nHost: {address}\r\nContent-Type: application/json\r\nX-Luna-Token: {token}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(head.as_bytes()).and_then(|_| stream.write_all(body.as_bytes())).map_err(|e| e.to_string())?;
    let mut reply = String::new();
    stream.read_to_string(&mut reply).map_err(|e| e.to_string())?;
    let payload = reply.split("\r\n\r\n").nth(1).unwrap_or_default();
    let value: Value = serde_json::from_str(payload).map_err(|e| format!("resposta inválida: {e}"))?;
    if value["ok"].as_bool() != Some(true) {
        return Err(value["error"].as_str().unwrap_or("pedido recusado pelo app").to_string());
    }
    Ok(value["decision"].clone())
}

fn parse_url(url: &str) -> Result<(String, String), String> {
    let rest = url.strip_prefix("http://").ok_or("LUNA_PERM_URL precisa ser http://")?;
    let (address, path) = rest.split_once('/').ok_or("LUNA_PERM_URL sem caminho")?;
    Ok((address.to_string(), format!("/{path}")))
}

// ---- Lado do app ----

/// Sobe o servidor local e grava a configuração MCP que o Claude lê nos turnos com permissão de pedido.
pub fn start(app: AppHandle, app_data: &Path) -> Result<(), String> {
    let token = crate::browser::new_token();
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("não foi possível abrir a porta de permissões: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let exe = std::env::current_exe().map_err(|e| format!("não foi possível localizar o executável: {e}"))?;
    let config = json!({
        "mcpServers": {
            SERVER: {
                "type": "stdio",
                "command": exe.display().to_string(),
                "args": ["permission-mcp"],
                "env": {
                    "LUNA_PERM_URL": format!("http://127.0.0.1:{port}/request"),
                    "LUNA_PERM_TOKEN": token,
                }
            }
        }
    });
    std::fs::create_dir_all(app_data).map_err(|e| e.to_string())?;
    let path = app_data.join("permission-mcp.json");
    std::fs::write(&path, serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?)
        .map_err(|e| format!("não foi possível gravar {}: {e}", path.display()))?;

    let _ = APP.set(app);
    let _ = TOKEN.set(token);
    let _ = CONFIG.set(path);
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            std::thread::spawn(move || handle_connection(stream));
        }
    });
    Ok(())
}

/// Caminho da configuração MCP de permissão, quando o servidor já subiu.
pub fn mcp_config() -> Option<&'static Path> {
    CONFIG.get().map(PathBuf::as_path)
}

fn handle_connection(stream: TcpStream) {
    let mut reader = BufReader::new(match stream.try_clone() {
        Ok(clone) => clone,
        Err(_) => return,
    });
    let mut writer = stream;
    let (status, payload) = match read_request(&mut reader) {
        Ok((path, token, body)) => answer(&path, token.as_deref(), &body),
        Err(error) => (400, json!({ "ok": false, "error": error })),
    };
    let text = payload.to_string();
    let head = format!(
        "HTTP/1.1 {status} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        if status == 200 { "OK" } else { "Error" },
        text.len()
    );
    let _ = writer.write_all(head.as_bytes());
    let _ = writer.write_all(text.as_bytes());
}

fn read_request(reader: &mut impl BufRead) -> Result<(String, Option<String>, String), String> {
    let mut line = String::new();
    reader.read_line(&mut line).map_err(|e| e.to_string())?;
    let mut parts = line.split_whitespace();
    let method = parts.next().unwrap_or_default();
    let path = parts.next().unwrap_or_default().to_string();
    if method != "POST" {
        return Err("use POST".into());
    }
    let mut length = 0usize;
    let mut token = None;
    loop {
        let mut header = String::new();
        reader.read_line(&mut header).map_err(|e| e.to_string())?;
        let header = header.trim_end();
        if header.is_empty() {
            break;
        }
        if let Some((name, value)) = header.split_once(':') {
            match name.trim().to_ascii_lowercase().as_str() {
                "content-length" => length = value.trim().parse().map_err(|_| "Content-Length inválido".to_string())?,
                "x-luna-token" => token = Some(value.trim().to_string()),
                _ => {}
            }
        }
    }
    if length > MAX_BODY {
        return Err("corpo grande demais".into());
    }
    let mut body = vec![0u8; length];
    reader.read_exact(&mut body).map_err(|e| e.to_string())?;
    Ok((path, token, String::from_utf8_lossy(&body).into_owned()))
}

/// Decide a resposta de uma requisição: rota, token e corpo. O pedido fica aberto até a pessoa decidir.
fn answer(path: &str, token: Option<&str>, body: &str) -> (u16, Value) {
    let expected = TOKEN.get().map(String::as_str).unwrap_or("");
    if path != "/request" {
        return (404, json!({ "ok": false, "error": "rota desconhecida" }));
    }
    if expected.is_empty() || token != Some(expected) {
        return (401, json!({ "ok": false, "error": "token inválido" }));
    }
    let request: Value = match serde_json::from_str(body) {
        Ok(value) => value,
        Err(error) => return (400, json!({ "ok": false, "error": format!("pedido inválido: {error}") })),
    };
    let Some(app) = APP.get() else {
        return (503, json!({ "ok": false, "error": "app ainda não está pronto" }));
    };
    let id = next_id();
    let (sender, receiver) = mpsc::channel();
    pending().lock().unwrap_or_else(|p| p.into_inner()).insert(id.clone(), sender);
    let payload = PermissionRequest {
        id: id.clone(),
        run_id: request["runId"].as_str().unwrap_or_default().to_string(),
        tool_name: request["toolName"].as_str().unwrap_or_default().to_string(),
        input: request["input"].clone(),
        tool_use_id: request["toolUseId"].as_str().unwrap_or_default().to_string(),
    };
    if let Err(error) = app.emit(REQUEST_EVENT, &payload) {
        pending().lock().unwrap_or_else(|p| p.into_inner()).remove(&id);
        return (500, json!({ "ok": false, "error": format!("não foi possível mostrar o pedido: {error}") }));
    }
    let decision = match receiver.recv_timeout(WAIT) {
        Ok(decision) => decision,
        Err(_) => {
            pending().lock().unwrap_or_else(|p| p.into_inner()).remove(&id);
            Decision { allow: false, message: Some("tempo esgotado sem resposta da pessoa".into()) }
        }
    };
    (200, json!({ "ok": true, "decision": decision_json(&decision, &payload.input) }))
}

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    format!("perm-{nanos:x}-{n}")
}

/// Entrega a decisão ao pedido aberto. Devolve false se o pedido já não existe (expirou ou foi respondido).
pub fn resolve(id: &str, decision: Decision) -> bool {
    let sender = pending().lock().unwrap_or_else(|p| p.into_inner()).remove(id);
    match sender {
        Some(sender) => sender.send(decision).is_ok(),
        None => false,
    }
}

/// Comando do front: a pessoa permite ou nega um pedido.
#[tauri::command]
pub fn answer_permission(id: String, allow: bool, message: Option<String>) -> Result<(), String> {
    if resolve(&id, Decision { allow, message }) {
        Ok(())
    } else {
        Err("pedido de permissão não encontrado; ele pode ter expirado".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allow_returns_the_original_input() {
        let input = json!({ "file_path": "a.txt" });
        let value = decision_json(&Decision { allow: true, message: None }, &input);
        assert_eq!(value, json!({ "behavior": "allow", "updatedInput": { "file_path": "a.txt" } }));
    }

    #[test]
    fn deny_carries_the_message_back_to_the_agent() {
        let value = decision_json(&Decision { allow: false, message: Some("não agora".into()) }, &json!({}));
        assert_eq!(value, json!({ "behavior": "deny", "message": "não agora" }));
    }

    #[test]
    fn deny_without_message_has_a_default() {
        let value = decision_json(&Decision { allow: false, message: None }, &json!({}));
        assert_eq!(value["behavior"], "deny");
        assert!(value["message"].as_str().unwrap().contains("pela pessoa"));
    }

    #[test]
    fn the_cli_gets_the_tool_it_expects() {
        let reply = handle_rpc(&json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }), "run", &mut |_| Err("x".into())).unwrap();
        assert_eq!(reply["result"]["tools"][0]["name"], TOOL);
        assert_eq!(PROMPT_TOOL, "mcp__luna-perm__approve");
    }

    #[test]
    fn a_tool_call_gets_the_decision_as_text() {
        let call = json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": { "name": TOOL, "arguments": { "tool_name": "Bash", "input": { "command": "ls" }, "tool_use_id": "t1" } } });
        let mut seen = None;
        let reply = handle_rpc(&call, "run-1", &mut |request| {
            seen = Some(request.clone());
            Ok(json!({ "behavior": "allow", "updatedInput": { "command": "ls" } }))
        })
        .unwrap();
        let text = reply["result"]["content"][0]["text"].as_str().unwrap();
        assert_eq!(serde_json::from_str::<Value>(text).unwrap()["behavior"], "allow");
        assert_eq!(seen.unwrap()["runId"], "run-1");
    }

    #[test]
    fn a_failed_ask_denies_the_action() {
        let call = json!({ "jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": { "name": TOOL, "arguments": { "tool_name": "Bash", "input": {} } } });
        let reply = handle_rpc(&call, "run", &mut |_| Err("app caiu".into())).unwrap();
        let text = reply["result"]["content"][0]["text"].as_str().unwrap();
        let decision: Value = serde_json::from_str(text).unwrap();
        assert_eq!(decision["behavior"], "deny");
        assert_eq!(decision["message"], "app caiu");
    }

    #[test]
    fn resolving_an_unknown_request_reports_false() {
        assert!(!resolve("perm-nao-existe", Decision { allow: true, message: None }));
    }

    #[test]
    fn a_waiting_request_receives_the_decision() {
        let (sender, receiver) = mpsc::channel();
        pending().lock().unwrap().insert("perm-teste-1".into(), sender);
        assert!(resolve("perm-teste-1", Decision { allow: false, message: Some("nope".into()) }));
        assert_eq!(receiver.recv().unwrap(), Decision { allow: false, message: Some("nope".into()) });
    }

    #[test]
    fn urls_are_split_into_address_and_path() {
        assert_eq!(parse_url("http://127.0.0.1:4000/request").unwrap(), ("127.0.0.1:4000".into(), "/request".into()));
        assert!(parse_url("https://x/y").is_err());
    }
}
