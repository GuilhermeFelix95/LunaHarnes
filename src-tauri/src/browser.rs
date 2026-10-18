//! Navegador integrado: uma webview filha dentro da janela principal, na aba ao lado do Terminal.
//! O agente usa a mesma webview por ferramentas MCP: o próprio executável roda em modo `browser-mcp`
//! (ver `mcp_stdio`) e fala com um servidor HTTP local, que só aceita o token gerado no início do app.
use std::collections::hash_map::RandomState;
use std::hash::{BuildHasher, Hasher};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::OnceLock;
use std::time::Duration;

use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Position, Rect, Size, Url, Webview, WebviewBuilder, WebviewUrl};

/// Rótulo fixo da webview do navegador.
pub const LABEL: &str = "luna-browser";
/// Evento enviado ao painel quando o agente abre uma página. O payload é o endereço.
pub const OPENED_EVENT: &str = "browser://opened";
/// Janela principal (o Tauri dá o rótulo "main" quando o config não define outro).
const MAIN_WINDOW: &str = "main";
/// Porta do servidor de desenvolvimento do app (`devUrl` em tauri.conf.json).
const DEV_SERVER_PORT: u16 = 1420;
/// Texto da página devolvido ao agente: o começo basta, e evita estourar o contexto.
const READ_LIMIT: usize = 20_000;
const CALLBACK_TIMEOUT: Duration = Duration::from_secs(10);
/// Posição e tamanho padrão quando o agente abre o navegador antes da aba: a aba ajusta depois.
const DEFAULT_BOUNDS: Bounds = Bounds { x: 0.0, y: 0.0, width: 900.0, height: 600.0 };
const TOOL_NAMES: [&str; 4] = ["browser_navigate", "browser_read", "browser_click", "browser_type"];

static APP: OnceLock<AppHandle> = OnceLock::new();
static TOKEN: OnceLock<String> = OnceLock::new();
static CONFIG: OnceLock<PathBuf> = OnceLock::new();

/// Retângulo da aba em pixels lógicos, relativo à janela.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Endereço digitado ou pedido pelo agente. Só http e https; sem esquema, assume https quando parece um domínio.
pub fn parse_url(input: &str) -> Result<Url, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("endereço vazio".into());
    }
    let candidate = if trimmed.contains("://") {
        trimmed.to_string()
    } else if trimmed.contains('.') && !trimmed.contains(char::is_whitespace) {
        format!("https://{trimmed}")
    } else {
        return Err(format!("endereço inválido: \"{trimmed}\""));
    };
    let url = Url::parse(&candidate).map_err(|e| format!("endereço inválido: {e}"))?;
    match url.scheme() {
        "http" | "https" => {}
        other => return Err(format!("só http e https são permitidos, não \"{other}\"")),
    }
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1"));
    if local && url.port() == Some(DEV_SERVER_PORT) {
        return Err("esse endereço é o servidor de desenvolvimento do próprio app".into());
    }
    Ok(url)
}

fn rect(bounds: Bounds) -> Result<Rect, String> {
    if bounds.width <= 0.0 || bounds.height <= 0.0 {
        return Err("a área do navegador está sem tamanho".into());
    }
    Ok(Rect {
        position: Position::Logical(LogicalPosition::new(bounds.x, bounds.y)),
        size: Size::Logical(LogicalSize::new(bounds.width, bounds.height)),
    })
}

fn app() -> Result<&'static AppHandle, String> {
    APP.get().ok_or_else(|| "o app ainda não terminou de iniciar".to_string())
}

fn webview() -> Result<Webview, String> {
    app()?
        .get_webview(LABEL)
        .ok_or_else(|| "o navegador ainda não foi aberto: navegue com browser_navigate ou abra a aba Navegador".to_string())
}

/// Cria a webview filha na janela principal, ou só navega se ela já existe.
fn open_at(url: Url, bounds: Bounds) -> Result<Webview, String> {
    let app = app()?;
    if let Some(existing) = app.get_webview(LABEL) {
        existing.navigate(url).map_err(|e| format!("não foi possível navegar: {e}"))?;
        return Ok(existing);
    }
    let window = app.get_window(MAIN_WINDOW).ok_or("janela principal não encontrada")?;
    window
        .add_child(
            WebviewBuilder::new(LABEL, WebviewUrl::External(url)),
            LogicalPosition::new(bounds.x, bounds.y),
            LogicalSize::new(bounds.width, bounds.height),
        )
        .map_err(|e| format!("não foi possível abrir o navegador: {e}"))
}

/// Roda JavaScript na página e espera o resultado. O Tauri devolve o valor já serializado como texto JSON,
/// então um texto JSON vem com aspas em volta: desfaz essa camada.
fn eval_and_wait(view: &Webview, script: String) -> Result<String, String> {
    let (tx, rx) = mpsc::channel();
    view.eval_with_callback(script, move |raw| {
        let _ = tx.send(raw);
    })
    .map_err(|e| format!("não foi possível rodar o script na página: {e}"))?;
    let raw = rx
        .recv_timeout(CALLBACK_TIMEOUT)
        .map_err(|_| "a página não respondeu a tempo".to_string())?;
    Ok(serde_json::from_str::<String>(&raw).unwrap_or(raw))
}

fn read_script() -> String {
    format!(
        "(() => JSON.stringify({{ url: location.href, title: document.title, text: (document.body ? document.body.innerText : '').slice(0, {READ_LIMIT}) }}))()"
    )
}

/// Clique ou digitação num elemento. Seletor e texto entram como literais JSON, então não há injeção.
fn act_script(action: &str, selector: &str, text: &str) -> Result<String, String> {
    let selector = serde_json::to_string(selector).map_err(|e| e.to_string())?;
    let text = serde_json::to_string(text).map_err(|e| e.to_string())?;
    let operation = match action {
        "click" => "el.click();".to_string(),
        "type" => format!(
            "el.focus(); el.value = {text}; el.dispatchEvent(new Event('input', {{ bubbles: true }})); el.dispatchEvent(new Event('change', {{ bubbles: true }}));"
        ),
        other => return Err(format!("ação desconhecida: {other}")),
    };
    Ok(format!(
        "(() => {{ try {{ const el = document.querySelector({selector}); if (!el) return JSON.stringify({{ ok: false, error: 'elemento não encontrado' }}); {operation} return JSON.stringify({{ ok: true }}); }} catch (e) {{ return JSON.stringify({{ ok: false, error: String(e) }}); }} }})()"
    ))
}

// ---- Comandos do painel (a aba do navegador) ----

/// Assíncrono de propósito: criar a webview num comando síncrono trava no Windows (ver `add_child`).
#[tauri::command]
pub async fn browser_open(url: String, bounds: Bounds) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let url = parse_url(&url)?;
        let view = open_at(url, bounds)?;
        view.set_bounds(rect(bounds)?).map_err(|e| e.to_string())?;
        view.show().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn browser_set_bounds(bounds: Bounds) -> Result<(), String> {
    webview()?.set_bounds(rect(bounds)?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn browser_show(visible: bool) -> Result<(), String> {
    let view = match webview() {
        Ok(view) => view,
        // Sem navegador aberto, esconder não tem o que fazer.
        Err(_) if !visible => return Ok(()),
        Err(e) => return Err(e),
    };
    if visible {
        view.show().map_err(|e| e.to_string())
    } else {
        view.hide().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn browser_navigate(url: String) -> Result<String, String> {
    let url = parse_url(&url)?;
    webview()?.navigate(url.clone()).map_err(|e| e.to_string())?;
    Ok(url.to_string())
}

#[tauri::command]
pub fn browser_history(direction: String) -> Result<(), String> {
    let step = match direction.as_str() {
        "back" => "history.back()",
        "forward" => "history.forward()",
        other => return Err(format!("direção desconhecida: {other}")),
    };
    webview()?.eval(step).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn browser_reload() -> Result<(), String> {
    webview()?.reload().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_close() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| match webview() {
        Ok(view) => view.close().map_err(|e| e.to_string()),
        Err(_) => Ok(()),
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Endereço atual e título da página, como o agente os lê.
#[tauri::command]
pub async fn browser_read() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| read_page()).await.map_err(|e| e.to_string())?
}

fn read_page() -> Result<String, String> {
    let view = webview()?;
    eval_and_wait(&view, read_script())
}

// ---- Ferramentas do agente ----

/// Abre a página para o agente. Sem a aba aberta, a webview nasce escondida: a aba mostra depois.
fn tool_navigate(url: &str) -> Result<String, String> {
    let url = parse_url(url)?;
    let app = app()?;
    match app.get_webview(LABEL) {
        Some(view) => view.navigate(url.clone()).map_err(|e| e.to_string())?,
        None => {
            let view = open_at(url.clone(), DEFAULT_BOUNDS)?;
            view.hide().map_err(|e| e.to_string())?;
        }
    }
    // Avisa o painel, para que o endereço apareça mesmo com a aba fechada.
    let _ = app.emit(OPENED_EVENT, url.as_str());
    Ok(format!("Página aberta: {url}"))
}

fn tool_act(action: &str, selector: &str, text: &str) -> Result<String, String> {
    if selector.trim().is_empty() {
        return Err("informe um seletor CSS para o elemento".into());
    }
    let view = webview()?;
    let script = act_script(action, selector, text)?;
    let raw = eval_and_wait(&view, script)?;
    let result: Value = serde_json::from_str(&raw).map_err(|e| format!("resposta inesperada da página: {e}"))?;
    if result["ok"].as_bool() == Some(true) {
        Ok(format!("ok: {action} em \"{selector}\""))
    } else {
        Err(result["error"].as_str().unwrap_or("falhou sem detalhe").to_string())
    }
}

/// Executa uma ferramenta pelo nome e devolve o texto para o agente.
fn dispatch_tool(name: &str, args: &Value) -> Result<String, String> {
    let text = |key: &str| args[key].as_str().unwrap_or("").to_string();
    match name {
        "browser_navigate" => tool_navigate(&text("url")),
        "browser_read" => read_page(),
        "browser_click" => tool_act("click", &text("selector"), ""),
        "browser_type" => tool_act("type", &text("selector"), &text("text")),
        other => Err(format!("ferramenta desconhecida: {other}")),
    }
}

// ---- Servidor local (o processo MCP fala com o app por aqui) ----

fn new_token() -> String {
    // Chave aleatória do processo (o std a sorteia por execução), dada por duas amostras.
    let mut out = String::new();
    for _ in 0..2 {
        let mut hasher = RandomState::new().build_hasher();
        hasher.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        out.push_str(&format!("{:016x}", hasher.finish()));
    }
    out
}

/// Sobe o servidor local e grava a configuração MCP que o Claude lê em cada turno.
pub fn start(app: AppHandle, app_data: &Path) -> Result<(), String> {
    let token = new_token();
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("não foi possível abrir a porta do navegador: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let exe = std::env::current_exe().map_err(|e| format!("não foi possível localizar o executável: {e}"))?;
    let config = json!({
        "mcpServers": {
            "luna-browser": {
                "type": "stdio",
                "command": exe.display().to_string(),
                "args": ["browser-mcp"],
                "env": {
                    "LUNA_BROWSER_URL": format!("http://127.0.0.1:{port}/tool"),
                    "LUNA_BROWSER_TOKEN": token,
                }
            }
        }
    });
    std::fs::create_dir_all(app_data).map_err(|e| e.to_string())?;
    let path = app_data.join("browser-mcp.json");
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

/// Caminho da configuração MCP, quando o servidor do navegador já subiu.
pub fn mcp_config() -> Option<&'static Path> {
    CONFIG.get().map(PathBuf::as_path)
}

fn handle_connection(stream: TcpStream) {
    let mut reader = BufReader::new(match stream.try_clone() {
        Ok(clone) => clone,
        Err(_) => return,
    });
    let mut writer = stream;
    let response = match read_request(&mut reader) {
        Ok((path, token, body)) => answer(&path, token.as_deref(), &body),
        Err(e) => (400, json!({ "ok": false, "error": e })),
    };
    let payload = response.1.to_string();
    let head = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        response.0,
        if response.0 == 200 { "OK" } else { "Error" },
        payload.len()
    );
    let _ = writer.write_all(head.as_bytes());
    let _ = writer.write_all(payload.as_bytes());
}

const MAX_BODY: usize = 64 * 1024;

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

/// Decide a resposta de uma requisição: token, rota e corpo. Função pura para os testes.
fn answer(path: &str, token: Option<&str>, body: &str) -> (u16, Value) {
    let expected = TOKEN.get().map(String::as_str).unwrap_or("");
    if path != "/tool" {
        return (404, json!({ "ok": false, "error": "rota desconhecida" }));
    }
    if expected.is_empty() || token != Some(expected) {
        return (401, json!({ "ok": false, "error": "token inválido" }));
    }
    run_request(body)
}

fn run_request(body: &str) -> (u16, Value) {
    let request: Value = match serde_json::from_str(body) {
        Ok(v) => v,
        Err(e) => return (400, json!({ "ok": false, "error": format!("pedido inválido: {e}") })),
    };
    let name = request["name"].as_str().unwrap_or_default();
    let args = &request["arguments"];
    match dispatch_tool(name, args) {
        Ok(text) => (200, json!({ "ok": true, "text": text })),
        Err(error) => (200, json!({ "ok": false, "error": error })),
    }
}

// ---- Processo MCP (`lunaharness browser-mcp`, falado pelo Claude por stdin/stdout) ----

/// Lista de ferramentas que o agente vê.
pub fn tool_specs() -> Value {
    let url_schema = json!({ "type": "object", "properties": { "url": { "type": "string", "description": "Endereço http ou https" } }, "required": ["url"] });
    let empty = json!({ "type": "object", "properties": {} });
    let selector = json!({ "type": "string", "description": "Seletor CSS do elemento" });
    json!([
        { "name": "browser_navigate", "description": "Abre um endereço no navegador integrado do Luna.", "inputSchema": url_schema },
        { "name": "browser_read", "description": "Lê o endereço, o título e o texto visível da página aberta.", "inputSchema": empty },
        { "name": "browser_click", "description": "Clica no elemento que o seletor CSS encontra.", "inputSchema": { "type": "object", "properties": { "selector": selector }, "required": ["selector"] } },
        { "name": "browser_type", "description": "Preenche o campo que o seletor CSS encontra com o texto dado.", "inputSchema": { "type": "object", "properties": { "selector": selector, "text": { "type": "string" } }, "required": ["selector", "text"] } }
    ])
}

/// Trata uma mensagem JSON-RPC. `call` executa uma ferramenta e devolve o texto ou o erro.
/// Devolve None para notificações (sem id).
pub fn handle_rpc(message: &Value, call: &mut dyn FnMut(&str, &Value) -> Result<String, String>) -> Option<Value> {
    let id = message.get("id")?.clone();
    let method = message["method"].as_str().unwrap_or_default();
    let result = match method {
        "initialize" => json!({
            "protocolVersion": "2024-11-05",
            "capabilities": { "tools": {} },
            "serverInfo": { "name": "luna-browser", "version": env!("CARGO_PKG_VERSION") }
        }),
        "tools/list" => json!({ "tools": tool_specs() }),
        "tools/call" => {
            let name = message["params"]["name"].as_str().unwrap_or_default();
            if !TOOL_NAMES.contains(&name) {
                return Some(json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32602, "message": format!("ferramenta desconhecida: {name}") } }));
            }
            let args = &message["params"]["arguments"];
            match call(name, args) {
                Ok(text) => json!({ "content": [{ "type": "text", "text": text }], "isError": false }),
                Err(error) => json!({ "content": [{ "type": "text", "text": error }], "isError": true }),
            }
        }
        _ => return Some(json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32601, "message": format!("método não suportado: {method}") } })),
    };
    Some(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
}

/// Entrada do modo `browser-mcp`: lê mensagens por stdin e responde por stdout.
pub fn mcp_stdio() -> i32 {
    let url = std::env::var("LUNA_BROWSER_URL").unwrap_or_default();
    let token = std::env::var("LUNA_BROWSER_TOKEN").unwrap_or_default();
    let stdin = std::io::stdin();
    let mut stdout = std::io::stdout();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let message: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("luna-browser: mensagem inválida: {e}");
                continue;
            }
        };
        let mut call = |name: &str, args: &Value| forward(&url, &token, name, args);
        if let Some(reply) = handle_rpc(&message, &mut call) {
            if writeln!(stdout, "{reply}").and_then(|_| stdout.flush()).is_err() {
                break;
            }
        }
    }
    0
}

/// Manda a ferramenta ao app pelo servidor local e lê a resposta.
fn forward(url: &str, token: &str, name: &str, args: &Value) -> Result<String, String> {
    let rest = url.strip_prefix("http://").ok_or("endereço do navegador não configurado")?;
    let (address, path) = rest.split_once('/').map(|(a, p)| (a, format!("/{p}"))).unwrap_or((rest, "/".into()));
    let body = json!({ "name": name, "arguments": args }).to_string();
    let mut stream = TcpStream::connect(address).map_err(|e| format!("o Luna não está respondendo: {e}"))?;
    let request = format!(
        "POST {path} HTTP/1.1\r\nHost: {address}\r\nContent-Type: application/json\r\nX-Luna-Token: {token}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(request.as_bytes()).map_err(|e| e.to_string())?;
    let mut raw = String::new();
    stream.read_to_string(&mut raw).map_err(|e| e.to_string())?;
    let payload = raw.split_once("\r\n\r\n").map(|(_, b)| b).unwrap_or_default();
    let reply: Value = serde_json::from_str(payload).map_err(|e| format!("resposta inesperada do Luna: {e}"))?;
    if reply["ok"].as_bool() == Some(true) {
        Ok(reply["text"].as_str().unwrap_or_default().to_string())
    } else {
        Err(reply["error"].as_str().unwrap_or("falhou sem detalhe").to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_http_and_https_and_guesses_https_for_domains() {
        assert_eq!(parse_url("github.com").unwrap().as_str(), "https://github.com/");
        assert_eq!(parse_url("http://localhost:3000/a").unwrap().scheme(), "http");
        assert!(parse_url("javascript://x.com/%0aalert(1)").is_err());
        assert!(parse_url("file:///C:/segredo.txt").is_err());
        assert!(parse_url("data://x.com/a").is_err());
        assert!(parse_url("   ").is_err());
        assert!(parse_url("não é endereço").is_err());
    }

    #[test]
    fn refuses_the_app_dev_server_so_the_agent_cannot_reach_the_app_itself() {
        // A devUrl do app (vite em 1420) é a própria interface: abri-la dentro do navegador daria acesso ao app.
        assert!(parse_url("http://localhost:1420/").is_err());
        assert!(parse_url("http://127.0.0.1:1420/x").is_err());
        assert!(parse_url("http://localhost:3000/").is_ok());
    }

    #[test]
    fn act_script_embeds_selector_and_text_as_literals() {
        let script = act_script("type", "input[name='q\"]']", "olá \"mundo\"").unwrap();
        // O seletor e o texto saem como literais JSON: aspas não quebram o script.
        assert!(script.contains("document.querySelector(\"input[name='q\\\"]']\")"));
        assert!(script.contains("el.value = \"olá \\\"mundo\\\"\""));
        assert!(act_script("drag", "a", "").is_err());
    }

    #[test]
    fn tools_are_listed_and_unknown_tools_are_refused() {
        let list = handle_rpc(&json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }), &mut |_, _| Ok(String::new())).unwrap();
        let names: Vec<&str> = list["result"]["tools"].as_array().unwrap().iter().map(|t| t["name"].as_str().unwrap()).collect();
        assert_eq!(names, TOOL_NAMES);

        let refused = handle_rpc(
            &json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": { "name": "shell", "arguments": {} } }),
            &mut |_, _| Ok(String::new()),
        )
        .unwrap();
        assert_eq!(refused["error"]["code"], -32602);
    }

    #[test]
    fn tool_errors_come_back_as_error_content_and_notifications_get_no_reply() {
        let failed = handle_rpc(
            &json!({ "jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": { "name": "browser_read", "arguments": {} } }),
            &mut |_, _| Err("o navegador ainda não foi aberto".into()),
        )
        .unwrap();
        assert_eq!(failed["result"]["isError"], true);
        assert!(failed["result"]["content"][0]["text"].as_str().unwrap().contains("ainda não foi aberto"));

        assert!(handle_rpc(&json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }), &mut |_, _| Ok(String::new())).is_none());
    }

    #[test]
    fn requests_without_the_right_token_are_refused() {
        let _ = TOKEN.set("segredo-do-teste".into());
        assert_eq!(answer("/tool", None, "{}").0, 401);
        assert_eq!(answer("/tool", Some("outro"), "{}").0, 401);
        assert_eq!(answer("/outra", Some("segredo-do-teste"), "{}").0, 404);
    }
}
