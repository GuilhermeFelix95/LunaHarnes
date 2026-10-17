use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};

use crate::api_profiles::{self, ApiProfile, PresetInfo};
use crate::changes::{self, Changes};
use crate::conversations;
use crate::models::{self, ModelOption};
use crate::plugins::loader::{self, PluginScan};
use crate::providers::{fallback_events, Permission, ProviderEvent, ProviderKind, RunRequest};
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
    let env = match &request.profile {
        Some(id) => {
            let dir = app_data_dir(&app)?;
            let profile = load_profile(&dir, id)?;
            profile_env(&dir, &profile, request.provider)?
        }
        None => Vec::new(),
    };
    let provider = request.provider;
    let mut active = run.0.lock().expect("lock da execução ativa");
    if active.is_some() {
        return Err("já existe uma resposta em andamento; aguarde ou pare antes de enviar outra".into());
    }

    let mut session = Session::start_with_env(&request, &env)?;
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

/// Pasta de dados do app (conversas, plugins, perfis de API).
fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("não foi possível localizar a pasta de dados do app: {e}"))
}

fn load_profile(dir: &Path, id: &str) -> Result<ApiProfile, String> {
    api_profiles::load_all(dir)?
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("perfil de API `{id}` não encontrado"))
}

/// Variáveis do perfil para esta execução. Recusa motor diferente do pedido e perfil sem chave.
fn profile_env(dir: &Path, profile: &ApiProfile, provider: ProviderKind) -> Result<Vec<(String, String)>, String> {
    if profile.engine() != provider {
        return Err(format!("o perfil \"{}\" usa outro motor", profile.name));
    }
    let key = api_profiles::read_key(&profile.id)?.ok_or_else(|| {
        format!("o perfil \"{}\" ainda não tem chave. Cole a chave em Configurações > Contas e APIs.", profile.name)
    })?;
    let config = api_profiles::config_dir(dir, &profile.id);
    std::fs::create_dir_all(&config).map_err(|e| format!("não foi possível criar a pasta do perfil: {e}"))?;
    Ok(api_profiles::env_for(profile, &key, &config))
}

/// Provedores prontos para criar um perfil.
#[tauri::command]
pub fn api_presets() -> Vec<PresetInfo> {
    api_profiles::presets()
}

#[tauri::command]
pub fn list_api_profiles(app: AppHandle) -> Result<Vec<ApiProfile>, String> {
    api_profiles::load_all(&app_data_dir(&app)?)
}

/// Cria ou altera um perfil (sem chave). Devolve o perfil com o id definido.
#[tauri::command]
pub fn save_api_profile(app: AppHandle, profile: ApiProfile) -> Result<ApiProfile, String> {
    let dir = app_data_dir(&app)?;
    let ready = api_profiles::prepare(profile)?;
    let mut all = api_profiles::load_all(&dir)?;
    match all.iter_mut().find(|p| p.id == ready.id) {
        Some(existing) => *existing = ready.clone(),
        None => all.push(ready.clone()),
    }
    api_profiles::save_all(&dir, &all)?;
    Ok(ready)
}

#[tauri::command]
pub fn delete_api_profile(app: AppHandle, id: String) -> Result<(), String> {
    let dir = app_data_dir(&app)?;
    let mut all = api_profiles::load_all(&dir)?;
    all.retain(|p| p.id != id);
    api_profiles::save_all(&dir, &all)?;
    api_profiles::delete_key(&id)
}

/// Guarda a chave no cofre do Windows. A chave nunca volta para a interface.
#[tauri::command]
pub fn set_api_profile_key(app: AppHandle, id: String, key: String) -> Result<(), String> {
    load_profile(&app_data_dir(&app)?, &id)?;
    api_profiles::save_key(&id, &key)
}

/// Diz só se há chave salva; o valor não sai do cofre.
#[tauri::command]
pub fn api_profile_has_key(id: String) -> Result<bool, String> {
    api_profiles::read_key(&id).map(|key| key.is_some())
}

/// Manda um prompt mínimo pelo perfil e devolve a resposta: prova que a chave, a URL e o modelo funcionam.
#[tauri::command]
pub async fn test_api_profile(app: AppHandle, id: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = app_data_dir(&app)?;
        let profile = load_profile(&dir, &id)?;
        let env = profile_env(&dir, &profile, profile.engine())?;
        let request = RunRequest {
            provider: profile.engine(),
            prompt: "Responda apenas: ok".into(),
            session_id: None,
            cwd: dir.clone(),
            permission: Permission::ReadOnly,
            model: profile.default_model.clone(),
            effort: None,
            profile: Some(profile.id.clone()),
        };
        let mut session = Session::start_with_env(&request, &env)?;
        let mut text = String::new();
        let mut error = None;
        let mut ok = false;
        session.pump(request.provider, |event| match event {
            ProviderEvent::TextDelta { text: chunk } => text.push_str(&chunk),
            ProviderEvent::Error { message } => error = Some(message),
            ProviderEvent::Done { ok: finished } => ok = finished,
            _ => {}
        });
        session.finish().map_err(|e| format!("falha ao aguardar o CLI: {e}"))?;
        match (ok, error) {
            (true, _) => Ok(text.trim().to_string()),
            (false, Some(message)) => Err(message),
            (false, None) => Err("o CLI não respondeu".into()),
        }
    })
    .await
    .map_err(|e| format!("falha ao testar o perfil: {e}"))?
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
