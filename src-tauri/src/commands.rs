use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};

use crate::changes::{self, Changes};
use crate::conversations;
use crate::models::{self, ModelOption};
use crate::plugins::loader::{self, PluginScan};
use crate::providers::{fallback_events, ProviderEvent, ProviderKind, RunRequest};
use crate::session::{CancelHandle, Session};
use crate::terminal::{self, Terminals};

/// Nome do evento que o frontend escuta (espelha `PROVIDER_EVENT` em src/api.ts).
const PROVIDER_EVENT: &str = "provider-event";

/// Uma execução por vez, conforme o escopo do MVP (chat único).
#[derive(Default)]
pub struct ActiveRun(pub Mutex<Option<CancelHandle>>);

/// Inicia o CLI, envia o prompt e devolve sem esperar o fim: a saída chega por eventos.
#[tauri::command]
pub fn send_prompt(
    app: AppHandle,
    run: State<'_, ActiveRun>,
    request: RunRequest,
) -> Result<(), String> {
    request.validate()?;
    let provider = request.provider;
    let mut active = run.0.lock().expect("lock da execução ativa");
    if active.is_some() {
        return Err("já existe uma resposta em andamento; aguarde ou pare antes de enviar outra".into());
    }

    let mut session = Session::start(&request)?;
    *active = Some(session.cancel_handle());
    drop(active);

    std::thread::spawn(move || {
        let mut saw_done = false;
        session.pump(provider, |event| {
            if matches!(event, ProviderEvent::Done { .. }) {
                saw_done = true;
            }
            // Falha ao emitir só acontece se a janela já foi fechada; nada a fazer.
            let _ = app.emit(PROVIDER_EVENT, event);
        });

        let outcome = session.finish();
        if !saw_done {
            // O CLI morreu sem fechar o turno: o usuário precisa ver o motivo e o botão destrava.
            let (code, stderr) = match outcome {
                Ok((status, stderr)) => (status.code(), stderr),
                Err(e) => (None, format!("falha ao aguardar o processo: {e}")),
            };
            for event in fallback_events(provider, code, &stderr) {
                let _ = app.emit(PROVIDER_EVENT, event);
            }
        }

        let run = app.state::<ActiveRun>();
        *run.0.lock().expect("lock da execução ativa") = None;
    });

    Ok(())
}

/// Pasta de plugins do usuário: `<app_data>/plugins`.
fn plugins_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("plugins"))
        .map_err(|e| format!("não foi possível localizar a pasta de dados do app: {e}"))
}

/// Lista os plugins instalados e os erros de validação de cada um.
#[tauri::command]
pub fn list_plugins(app: AppHandle) -> Result<PluginScan, String> {
    Ok(loader::scan(&plugins_dir(&app)?))
}

/// Devolve o código do plugin para o frontend carregar como módulo.
#[tauri::command]
pub fn read_plugin_entry(app: AppHandle, id: String) -> Result<String, String> {
    loader::read_entry(&plugins_dir(&app)?, &id)
}

/// Pasta de conversas: `<app_data>/conversations`.
fn conversations_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("conversations"))
        .map_err(|e| format!("não foi possível localizar a pasta de dados do app: {e}"))
}

#[tauri::command]
pub fn list_conversations(app: AppHandle) -> Result<Vec<conversations::Summary>, String> {
    Ok(conversations::list(&conversations_dir(&app)?))
}

#[tauri::command]
pub fn load_conversation(app: AppHandle, id: String) -> Result<conversations::Conversation, String> {
    conversations::load(&conversations_dir(&app)?, &id)
}

#[tauri::command]
pub fn save_conversation(app: AppHandle, conversation: conversations::Conversation) -> Result<(), String> {
    conversations::save(&conversations_dir(&app)?, &conversation)
}

#[tauri::command]
pub fn delete_conversation(app: AppHandle, id: String) -> Result<(), String> {
    conversations::delete(&conversations_dir(&app)?, &id)
}

/// Pasta de trabalho inicial: a pasta de onde o `luna` foi rodado.
#[tauri::command]
pub fn get_workspace() -> Result<String, String> {
    std::env::current_dir()
        .map(|dir| dir.display().to_string())
        .map_err(|e| format!("não foi possível ler a pasta atual: {e}"))
}

/// Verifica se o usuário já entrou na conta do provedor.
#[tauri::command]
pub async fn check_auth(provider: ProviderKind) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || crate::auth::status(provider))
        .await
        .map_err(|e| format!("falha ao consultar o login: {e}"))?
}

/// Modelos e níveis de esforço que o CLI do provedor aceita.
#[tauri::command]
pub async fn list_models(provider: ProviderKind) -> Result<Vec<ModelOption>, String> {
    tauri::async_runtime::spawn_blocking(move || models::load(provider))
        .await
        .map_err(|e| format!("falha ao listar os modelos: {e}"))?
}

/// Arquivos alterados na pasta de trabalho (lidos do git).
#[tauri::command]
pub async fn get_changes(cwd: String) -> Result<Changes, String> {
    tauri::async_runtime::spawn_blocking(move || changes::collect(std::path::Path::new(&cwd)))
        .await
        .map_err(|e| format!("falha ao ler as alterações: {e}"))?
}

/// Diff de um arquivo alterado, relativo à pasta de trabalho.
#[tauri::command]
pub async fn get_file_diff(cwd: String, path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || changes::diff_of(std::path::Path::new(&cwd), &path))
        .await
        .map_err(|e| format!("falha ao ler o diff: {e}"))?
}

/// Terminais criados nesta execução do app; o id só serve para o frontend endereçar cada um.
static NEXT_TERMINAL: AtomicU64 = AtomicU64::new(1);

/// Abre um shell (PowerShell) na pasta dada. A saída chega pelo evento `terminal-data`.
#[tauri::command]
pub fn terminal_open(
    app: AppHandle,
    terminals: State<'_, Terminals>,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    let id = format!("term-{}", NEXT_TERMINAL.fetch_add(1, Ordering::Relaxed));
    let data_app = app.clone();
    let data_id = id.clone();
    let exit_app = app.clone();
    let exit_id = id.clone();

    let terminal = terminal::spawn(
        terminal::shell_command()?,
        Path::new(&cwd),
        cols,
        rows,
        move |data| {
            let _ = data_app.emit(terminal::DATA_EVENT, terminal::TerminalData { id: data_id.clone(), data });
        },
        move || {
            let _ = exit_app.emit(terminal::EXIT_EVENT, terminal::TerminalExit { id: exit_id });
        },
    )?;

    terminals.0.lock().expect("lock dos terminais").insert(id.clone(), terminal);
    Ok(id)
}

/// Envia teclas ao shell.
#[tauri::command]
pub fn terminal_write(terminals: State<'_, Terminals>, id: String, data: String) -> Result<(), String> {
    let mut map = terminals.0.lock().expect("lock dos terminais");
    map.get_mut(&id)
        .ok_or_else(|| format!("terminal {id} não existe mais"))?
        .write(&data)
}

#[tauri::command]
pub fn terminal_resize(terminals: State<'_, Terminals>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    let map = terminals.0.lock().expect("lock dos terminais");
    map.get(&id)
        .ok_or_else(|| format!("terminal {id} não existe mais"))?
        .resize(cols, rows)
}

/// Encerra o shell e tira o terminal da lista.
#[tauri::command]
pub fn terminal_close(terminals: State<'_, Terminals>, id: String) -> Result<(), String> {
    if let Some(mut terminal) = terminals.0.lock().expect("lock dos terminais").remove(&id) {
        terminal.kill();
    }
    Ok(())
}

/// Abre a janela de login oficial do CLI do provedor.
#[tauri::command]
pub fn open_login(provider: ProviderKind) -> Result<(), String> {
    crate::auth::open_login(provider)
}

/// Para a execução em andamento, se houver.
#[tauri::command]
pub fn cancel_prompt(run: State<'_, ActiveRun>) -> Result<(), String> {
    let active = run.0.lock().expect("lock da execução ativa");
    match active.as_ref() {
        Some(handle) => handle
            .cancel()
            .map_err(|e| format!("não foi possível parar a execução: {e}")),
        None => Ok(()),
    }
}
