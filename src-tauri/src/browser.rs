//! Navegador integrado: uma webview filha dentro da janela principal, na aba ao lado do Terminal.
//! O agente usa a mesma webview por ferramentas MCP: o próprio executável roda em modo `browser-mcp`
//! (ver `mcp_stdio`) e fala com um servidor HTTP local, que só aceita o token gerado no início do app.
use std::collections::hash_map::RandomState;
use std::hash::{BuildHasher, Hasher};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::Deserialize;
use serde_json::{json, Value};
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Position, Rect, Size, Url, Webview, WebviewBuilder, WebviewUrl};

use crate::commands::app_data_dir;
use crate::logfile;

/// Rótulo fixo da webview do navegador.
pub const LABEL: &str = "luna-browser";
/// Evento enviado ao painel quando o agente abre uma página. O payload é o endereço.
pub const OPENED_EVENT: &str = "browser://opened";
/// Uma página terminou de carregar numa aba (inclusive depois de clicar num link): o painel relê as abas.
pub const NAVIGATED_EVENT: &str = "browser://navigated";
/// Janela principal (o Tauri dá o rótulo "main" quando o config não define outro).
const MAIN_WINDOW: &str = "main";
/// Porta do servidor de desenvolvimento do app (`devUrl` em tauri.conf.json).
const DEV_SERVER_PORT: u16 = 1420;
/// Texto da página devolvido ao agente: o começo basta, e evita estourar o contexto.
const READ_LIMIT: usize = 20_000;
const CALLBACK_TIMEOUT: Duration = Duration::from_secs(10);
/// Quanto o agente espera a página carregar antes de ler o conteúdo.
const LOAD_TIMEOUT: Duration = Duration::from_secs(15);
/// Posição e tamanho padrão quando o agente abre o navegador antes da aba: a aba ajusta depois.
const DEFAULT_BOUNDS: Bounds = Bounds { x: 0.0, y: 0.0, width: 900.0, height: 600.0 };
const TOOL_NAMES: [&str; 4] = ["browser_navigate", "browser_read", "browser_click", "browser_type"];

static APP: OnceLock<AppHandle> = OnceLock::new();
static TOKEN: OnceLock<String> = OnceLock::new();
static CONFIG: OnceLock<PathBuf> = OnceLock::new();
/// Abas abertas. Cada aba é uma webview com rótulo `LABEL-<id>`; a ativa é a que o painel mostra e o agente usa.
static TABS: Mutex<TabSet> = Mutex::new(TabSet::new());

/// Limite de abas: cada uma é um processo do WebView2, então é preciso pôr um teto.
pub const MAX_TABS: usize = 8;

/// Ids das abas abertas, na ordem em que foram abertas. `economy` guarda as abas em que o usuário
/// pediu para economizar memória: só essas são suspensas quando ficam escondidas.
#[derive(Default)]
struct TabSet {
    next: u32,
    ids: Vec<u32>,
    active: Option<u32>,
    economy: Vec<u32>,
}

impl TabSet {
    const fn new() -> Self {
        Self { next: 0, ids: Vec::new(), active: None, economy: Vec::new() }
    }

    fn is_economy(&self, id: u32) -> bool {
        self.economy.contains(&id)
    }

    /// Liga ou desliga a economia de memória de uma aba aberta. Devolve false se ela não existe.
    fn set_economy(&mut self, id: u32, on: bool) -> bool {
        if !self.ids.contains(&id) {
            return false;
        }
        self.economy.retain(|other| *other != id);
        if on {
            self.economy.push(id);
        }
        true
    }

    /// Reserva o id de uma aba nova, ou recusa quando o limite já foi atingido.
    fn reserve(&mut self) -> Result<u32, String> {
        if self.ids.len() >= MAX_TABS {
            return Err(format!("o navegador aceita até {MAX_TABS} abas; feche uma para abrir outra"));
        }
        self.next += 1;
        self.ids.push(self.next);
        Ok(self.next)
    }

    /// Tira a aba da lista. Se ela era a ativa, a última aberta passa a ser a ativa, e a devolve.
    fn forget(&mut self, id: u32) -> Option<u32> {
        self.ids.retain(|other| *other != id);
        self.economy.retain(|other| *other != id);
        if self.active == Some(id) {
            self.active = self.ids.last().copied();
        }
        self.active
    }
}

fn tab_label(id: u32) -> String {
    format!("{LABEL}-{id}")
}

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

/// A aba ativa. Sem aba aberta, o agente e o painel recebem a mesma mensagem.
fn webview() -> Result<Webview, String> {
    let id = TABS
        .lock()
        .map_err(|_| "estado do navegador travado".to_string())?
        .active
        .ok_or_else(|| "o navegador ainda não foi aberto: navegue com browser_navigate ou abra a aba Navegador".to_string())?;
    app()?
        .get_webview(&tab_label(id))
        .ok_or_else(|| "a aba ativa do navegador não existe mais".to_string())
}

/// Cria uma aba com a página e a torna a ativa. Só a ativa fica visível.
fn create_tab(url: Url, bounds: Bounds, visible: bool) -> Result<u32, String> {
    let app = app()?;
    let window = app.get_window(MAIN_WINDOW).ok_or("janela principal não encontrada")?;
    let id = TABS.lock().map_err(|_| "estado do navegador travado".to_string())?.reserve()?;
    let page_app = app.clone();
    let created = window.add_child(
        // Sem foco: a página não rouba o teclado do chat quando nasce.
        WebviewBuilder::new(&tab_label(id), WebviewUrl::External(url))
            .focused(false)
            .on_page_load(move |view, payload| {
                if payload.event() == PageLoadEvent::Finished {
                    // Histórico: cada página terminada de carregar entra nas visitas recentes.
                    if let Ok(url) = view.url() {
                        if url.scheme() == "http" || url.scheme() == "https" {
                            match app_data_dir(&page_app) {
                                Ok(dir) => {
                                    if let Err(e) = crate::browser_history::record_in(&dir, url.as_str()) {
                                        logfile::error(&format!("não foi possível registrar a visita no histórico: {e}"));
                                    }
                                }
                                Err(e) => logfile::error(&e),
                            }
                        }
                    }
                    let _ = page_app.emit(NAVIGATED_EVENT, ());
                }
            }),
        LogicalPosition::new(bounds.x, bounds.y),
        LogicalSize::new(bounds.width, bounds.height),
    );
    if let Err(e) = created {
        // A aba não chegou a existir: tira o id reservado.
        TABS.lock().map_err(|_| "estado do navegador travado".to_string())?.forget(id);
        return Err(format!("não foi possível abrir o navegador: {e}"));
    }
    if let Some(view) = app.get_webview(&tab_label(id)) {
        // Sem a senha salva, o navegador só lembra a sessão: falha aqui só vai para o log, e a aba segue.
        if let Err(e) = enable_password_autosave(&view) {
            logfile::error(&format!("não foi possível ligar o salvamento de senha da aba {id}: {e}"));
        }
        crate::adblock::install(&view);
    }
    show_only(app, id)?;
    if !visible {
        if let Some(view) = app.get_webview(&tab_label(id)) {
            view.hide().map_err(|e| e.to_string())?;
        }
    }
    Ok(id)
}

/// Liga o salvamento de senha do WebView2 no perfil do app: o navegador pergunta se quer salvar e preenche depois.
/// A propriedade fica no perfil (`ICoreWebView2Profile6`), então vale para todas as abas do app.
#[cfg(windows)]
fn enable_password_autosave(view: &Webview) -> Result<(), String> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{ICoreWebView2Profile6, ICoreWebView2_13};
    use windows_core::Interface;
    view.with_webview(|platform| {
        let controller = platform.controller();
        let result = unsafe {
            controller
                .CoreWebView2()
                .and_then(|core| core.cast::<ICoreWebView2_13>())
                .and_then(|core| core.Profile())
                .and_then(|profile| profile.cast::<ICoreWebView2Profile6>())
                .and_then(|profile| profile.SetIsPasswordAutosaveEnabled(true))
        };
        if let Err(e) = result {
            logfile::error(&format!("WebView2 não aceitou ligar o salvamento de senha: {e}"));
        }
    })
    .map_err(|e| e.to_string())
}

#[cfg(not(windows))]
fn enable_password_autosave(_view: &Webview) -> Result<(), String> {
    Ok(())
}

/// Torna `id` a aba ativa: esconde as outras e acorda a escolhida. Abas em modo economia são suspensas ao esconder;
/// as demais ficam rodando, para a página não recarregar nem perder o estado ao voltar a elas.
fn show_only(app: &AppHandle, id: u32) -> Result<(), String> {
    let others: Vec<(u32, bool)> = {
        let mut tabs = TABS.lock().map_err(|_| "estado do navegador travado".to_string())?;
        if !tabs.ids.contains(&id) {
            return Err("essa aba não está aberta".to_string());
        }
        tabs.active = Some(id);
        tabs.ids
            .iter()
            .copied()
            .filter(|other| *other != id)
            .map(|other| (other, tabs.is_economy(other)))
            .collect()
    };
    for (other, economy) in others {
        if let Some(view) = app.get_webview(&tab_label(other)) {
            let _ = view.hide();
            if economy {
                set_sleeping(&view, other, true);
            }
        }
    }
    if let Some(view) = app.get_webview(&tab_label(id)) {
        set_sleeping(&view, id, false);
    }
    Ok(())
}

/// Mostra uma aba e esconde as outras. Usado ao trocar de aba no painel.
fn activate_tab(id: u32) -> Result<(), String> {
    let app = app()?;
    show_only(app, id)?;
    let view = app.get_webview(&tab_label(id)).ok_or("a aba não existe mais")?;
    view.show().map_err(|e| e.to_string())
}

/// Suspende (`sleeping`) ou acorda uma aba. Falha só vai para o log: a aba segue, do jeito que estava.
fn set_sleeping(view: &Webview, id: u32, sleeping: bool) {
    if let Err(e) = apply_sleep(view, sleeping) {
        let action = if sleeping { "suspender" } else { "acordar" };
        logfile::error(&format!("não foi possível {action} a aba {id} do navegador: {e}"));
    }
}

#[cfg(windows)]
fn apply_sleep(view: &Webview, sleeping: bool) -> Result<(), String> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_19, ICoreWebView2_3, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
    };
    use windows_core::Interface;
    view.with_webview(move |platform| {
        let controller = platform.controller();
        let result = unsafe {
            controller.CoreWebView2().and_then(|core| {
                let level = if sleeping { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW } else { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL };
                core.cast::<ICoreWebView2_19>()?.SetMemoryUsageTargetLevel(level)?;
                let tabs = core.cast::<ICoreWebView2_3>()?;
                if sleeping {
                    tabs.TrySuspend(&webview2_com::TrySuspendCompletedHandler::create(Box::new(|_, _| Ok(()))))
                } else {
                    tabs.Resume()
                }
            })
        };
        if let Err(e) = result {
            let action = if sleeping { "suspender" } else { "acordar" };
            logfile::error(&format!("o WebView2 recusou {action} a aba do navegador: {e}"));
        }
    })
    .map_err(|e| e.to_string())
}

#[cfg(not(windows))]
fn apply_sleep(_view: &Webview, _sleeping: bool) -> Result<(), String> {
    Ok(())
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
pub async fn browser_new_tab(url: Option<String>, bounds: Bounds) -> Result<u32, String> {
    tauri::async_runtime::spawn_blocking(move || {
        // Sem endereço, a aba abre em branco: o usuário digita depois.
        let url = match url {
            Some(url) => parse_url(&url)?,
            None => Url::parse("about:blank").map_err(|e| e.to_string())?,
        };
        let id = create_tab(url, bounds, true)?;
        let view = app()?.get_webview(&tab_label(id)).ok_or("a aba não existe mais")?;
        view.set_bounds(rect(bounds)?).map_err(|e| e.to_string())?;
        Ok(id)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Uma aba aberta: o id e o endereço atual da página.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TabInfo {
    pub id: u32,
    pub url: String,
    /// Aba em modo economia de memória: suspensa quando fica escondida.
    pub economize: bool,
}

/// Abas abertas e a ativa. O painel usa para montar a barra de abas, inclusive depois de fechado e aberto.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserState {
    pub tabs: Vec<TabInfo>,
    pub active: Option<u32>,
    /// Bloqueador de anúncios ligado (padrão) ou pausado pelo usuário.
    pub adblock: bool,
}

#[tauri::command]
pub fn browser_state() -> Result<BrowserState, String> {
    let (ids, active, economy) = {
        let tabs = TABS.lock().map_err(|_| "estado do navegador travado".to_string())?;
        (tabs.ids.clone(), tabs.active, tabs.economy.clone())
    };
    let app = app()?;
    let tabs = ids
        .into_iter()
        .map(|id| TabInfo {
            id,
            url: app
                .get_webview(&tab_label(id))
                .and_then(|view| view.url().ok())
                .map(|url| url.to_string())
                .unwrap_or_default(),
            economize: economy.contains(&id),
        })
        .collect();
    Ok(BrowserState { tabs, active, adblock: crate::adblock::is_enabled() })
}

/// Liga ou pausa o bloqueador de anúncios. Vale para todas as abas, na hora.
#[tauri::command]
pub fn browser_set_adblock(on: bool) {
    crate::adblock::set_enabled(on);
}

/// Traduz a página da aba ativa, ou volta ao original quando `on` é falso. Devolve o endereço que a aba passou a mostrar.
#[tauri::command]
pub fn browser_translate(on: bool) -> Result<String, String> {
    let view = webview()?;
    let current = view.url().map_err(|e| e.to_string())?;
    let target = if on {
        crate::translate::translate_url(&current)?
    } else {
        crate::translate::original_of(&current).ok_or("esta página não está traduzida")?
    };
    view.navigate(target.clone()).map_err(|e| e.to_string())?;
    Ok(target.to_string())
}

/// Liga ou desliga a economia de memória de uma aba. Ligada, a aba é suspensa quando fica escondida.
#[tauri::command]
pub fn browser_set_economy(tab_id: u32, economize: bool) -> Result<(), String> {
    let mut tabs = TABS.lock().map_err(|_| "estado do navegador travado".to_string())?;
    if !tabs.set_economy(tab_id, economize) {
        return Err("essa aba não está aberta".to_string());
    }
    Ok(())
}

/// Troca a aba ativa e posiciona a página na área do painel.
#[tauri::command]
pub fn browser_switch_tab(tab_id: u32, bounds: Bounds) -> Result<(), String> {
    activate_tab(tab_id)?;
    webview()?.set_bounds(rect(bounds)?).map_err(|e| e.to_string())
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
/// Fecha uma aba. Se era a ativa, a última aberta assume. Devolve a aba ativa depois do fechamento, se houver.
pub async fn browser_close_tab(tab_id: u32) -> Result<Option<u32>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(view) = app()?.get_webview(&tab_label(tab_id)) {
            view.close().map_err(|e| e.to_string())?;
        }
        let next = TABS.lock().map_err(|_| "estado do navegador travado".to_string())?.forget(tab_id);
        if let Some(id) = next {
            activate_tab(id)?;
        }
        Ok(next)
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
    match webview() {
        Ok(view) => view.navigate(url.clone()).map_err(|e| e.to_string())?,
        // Sem aba ativa, o agente abre uma nova, escondida: a aba do painel mostra depois.
        Err(_) => {
            create_tab(url.clone(), DEFAULT_BOUNDS, false)?;
        }
    }
    // Avisa o painel, para que o endereço apareça mesmo com a aba fechada.
    let _ = app()?.emit(OPENED_EVENT, url.as_str());
    wait_until_loaded();
    Ok(format!("Página aberta: {url}"))
}

/// Espera a página terminar de carregar, para o agente ler o conteúdo certo. Se estourar o prazo, segue assim mesmo.
fn wait_until_loaded() {
    let deadline = Instant::now() + LOAD_TIMEOUT;
    while Instant::now() < deadline {
        if let Ok(view) = webview() {
            if let Ok(state) = eval_and_wait(&view, "document.readyState".into()) {
                if state == "complete" {
                    return;
                }
            }
        }
        std::thread::sleep(Duration::from_millis(300));
    }
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

// ---- Processo MCP (`lunacode browser-mcp`, falado pelo Claude por stdin/stdout) ----

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

#[cfg(test)]
mod tab_tests {
    use super::*;

    #[test]
    fn reserves_up_to_the_limit_then_refuses() {
        let mut tabs = TabSet::new();
        for expected in 1..=MAX_TABS as u32 {
            assert_eq!(tabs.reserve(), Ok(expected));
        }

        let err = tabs.reserve().unwrap_err();
        assert!(err.contains(&format!("{MAX_TABS} abas")), "{err}");
    }

    #[test]
    fn closing_the_active_tab_hands_over_to_the_last_one() {
        let mut tabs = TabSet::new();
        let first = tabs.reserve().unwrap();
        let second = tabs.reserve().unwrap();
        let third = tabs.reserve().unwrap();
        tabs.active = Some(first);

        assert_eq!(tabs.forget(first), Some(third));
        assert_eq!(tabs.ids, vec![second, third]);
    }

    #[test]
    fn closing_an_inactive_tab_keeps_the_active_one() {
        let mut tabs = TabSet::new();
        let first = tabs.reserve().unwrap();
        let second = tabs.reserve().unwrap();
        tabs.active = Some(second);

        assert_eq!(tabs.forget(first), Some(second));
    }

    #[test]
    fn closing_the_last_tab_leaves_no_active_tab() {
        let mut tabs = TabSet::new();
        let only = tabs.reserve().unwrap();
        tabs.active = Some(only);

        assert_eq!(tabs.forget(only), None);
        assert!(tabs.ids.is_empty());
    }

    #[test]
    fn economy_is_set_per_tab_and_leaves_with_the_tab() {
        let mut set = TabSet::new();
        let first = set.reserve().unwrap();
        let second = set.reserve().unwrap();
        assert!(set.set_economy(first, true));
        assert!(set.is_economy(first));
        assert!(!set.is_economy(second));
        set.forget(first);
        assert!(!set.is_economy(first));
        assert!(!set.set_economy(first, true), "aba fechada não recebe economia");
    }

    #[test]
    fn tab_labels_are_unique_per_tab() {
        assert_ne!(tab_label(1), tab_label(2));
        assert!(tab_label(3).starts_with(LABEL));
    }
}
