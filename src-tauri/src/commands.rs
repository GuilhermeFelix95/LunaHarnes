use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use base64::{engine::general_purpose::STANDARD, Engine};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::api_profiles::{self, ApiProfile, Preset, PresetInfo, RemoteModels};
use crate::changes::{self, Changes};
use crate::checkpoints;
use crate::conversations;
use crate::models::{self, ModelOption};
use crate::plugins::local;
use crate::plugins::loader::{self, Manifest, PluginScan};
use crate::plugins::marketplace::{self, Catalog, PluginsState};
use crate::providers::{claude, fallback_events, image_media_type, Permission, ProviderEvent, ProviderKind, RunRequest};
use crate::session::{CancelHandle, Session};
use crate::setup;
use crate::spec;
use crate::terminal::{self, Terminals};

/// Nome do evento que o frontend escuta (espelha `PROVIDER_EVENT` em src/api.ts).
const PROVIDER_EVENT: &str = "provider-event";

/// Tamanho máximo de uma imagem anexada, em bytes.
const MAX_ATTACHMENT_BYTES: usize = 10 * 1024 * 1024;

/// Contador para nomes de anexo distintos dentro do mesmo milissegundo.
static NEXT_ATTACHMENT: AtomicU64 = AtomicU64::new(1);

/// Uma execução por conversa: cada `run_id` (id da aba do chat) tem o seu processo.
/// Conversas diferentes rodam ao mesmo tempo; a mesma conversa não aceita dois envios.
#[derive(Default)]
pub struct ActiveRuns(pub Mutex<HashMap<String, CancelHandle>>);

/// Evento de execução: o frontend filtra pelo `run_id` para entregar à conversa certa.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RunEvent<'a> {
    run_id: &'a str,
    event: ProviderEvent,
}

/// Inicia o CLI, envia o prompt e devolve sem esperar o fim: a saída chega por eventos.
#[tauri::command]
pub fn send_prompt(
    app: AppHandle,
    runs: State<'_, ActiveRuns>,
    mut request: RunRequest,
    run_id: String,
) -> Result<(), String> {
    request.validate()?;
    // A spec do projeto (pasta spec/) vai em toda chamada, antes do pedido. Vale para qualquer provedor.
    let spec = spec::load_spec(&request.cwd)?;
    request.prompt = spec::with_spec(&spec, &request.prompt);
    if run_id.is_empty() || run_id.len() > 64 || !run_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("identificador de execução inválido".into());
    }
    let mut env = match &request.profile {
        Some(id) => {
            let dir = app_data_dir(&app)?;
            let profile = load_profile(&dir, id)?;
            profile_env(&dir, &profile, request.provider)?
        }
        None => Vec::new(),
    };
    // O Claude Code liga as ferramentas de tarefa com esta variável (alimenta a aba Progresso).
    if request.provider == ProviderKind::Claude {
        let (key, value) = claude::task_env();
        env.push((key, value));
    }
    // Imagens só podem vir da pasta de anexos do app: o pedido não lê arquivo arbitrário do disco.
    if !request.images.is_empty() {
        let folder = app_data_dir(&app)?.join("attachments");
        let folder = folder.canonicalize().ok();
        for image in &request.images {
            let inside = image
                .canonicalize()
                .ok()
                .zip(folder.clone())
                .is_some_and(|(file, folder)| file.starts_with(folder));
            if !inside {
                return Err("imagem fora da pasta de anexos do app".into());
            }
        }
    }

    let provider = request.provider;
    let mut active = runs.0.lock().expect("lock das execuções ativas");
    if active.contains_key(&run_id) {
        return Err("já existe uma resposta em andamento nesta conversa; aguarde ou pare antes de enviar outra".into());
    }

    let mut session = Session::start_with_env(&request, &env)?;
    active.insert(run_id.clone(), session.cancel_handle());
    drop(active);

    std::thread::spawn(move || {
        let mut saw_done = false;
        session.pump(provider, |event| {
            if matches!(event, ProviderEvent::Done { .. }) {
                saw_done = true;
            }
            // Falha ao emitir só acontece se a janela já foi fechada; nada a fazer.
            let _ = app.emit(PROVIDER_EVENT, RunEvent { run_id: &run_id, event });
        });

        let outcome = session.finish();
        if !saw_done {
            // O CLI morreu sem fechar o turno: o usuário precisa ver o motivo e o botão destrava.
            let (code, stderr) = match outcome {
                Ok((status, stderr)) => (status.code(), stderr),
                Err(e) => (None, format!("falha ao aguardar o processo: {e}")),
            };
            for event in fallback_events(provider, code, &stderr) {
                let _ = app.emit(PROVIDER_EVENT, RunEvent { run_id: &run_id, event });
            }
        }

        let runs = app.state::<ActiveRuns>();
        runs.0.lock().expect("lock das execuções ativas").remove(&run_id);
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

/// Atualiza a lista de modelos de um perfil salvo, com a chave guardada. Não grava nada: a tela decide.
#[tauri::command]
pub async fn refresh_api_models(app: AppHandle, id: String) -> Result<RemoteModels, String> {
    let dir = app_data_dir(&app)?;
    let profile = load_profile(&dir, &id)?;
    let key = api_profiles::read_key(&id)?
        .ok_or_else(|| format!("o perfil \"{}\" ainda não tem chave. Cole a chave antes de atualizar.", profile.name))?;
    let base = profile
        .effective_base_url()
        .ok_or_else(|| "este provedor não tem endereço de API para listar modelos".to_string())?;
    api_profiles::fetch_models(profile.preset, &base, &key).await
}

/// Lista os modelos de um provedor com a chave que está na tela, antes de salvar o perfil.
/// A chave vai só para a requisição; não é gravada nem devolvida.
#[tauri::command]
pub async fn list_provider_models(preset: Preset, base_url: String, api_key: String) -> Result<RemoteModels, String> {
    if api_key.trim().is_empty() {
        return Err("cole a chave da API para listar os modelos".into());
    }
    let base = api_profiles::base_url_for(preset, &base_url)?;
    api_profiles::fetch_models(preset, &base, api_key.trim()).await
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
            images: Vec::new(),
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

/// Nome do catálogo oficial embutido no app, para o frontend pedir sem URL.
const OFFICIAL_SOURCE: &str = "oficial";

/// Catálogo oficial (embutido) ou um dos catálogos por URL que o usuário adicionou.
async fn catalog_of(app: &AppHandle, source: &str) -> Result<Catalog, String> {
    if source == OFFICIAL_SOURCE {
        return marketplace::official();
    }
    let dir = app_data_dir(app)?;
    if !marketplace::load_sources(&dir)?.urls.iter().any(|u| u == source) {
        return Err("este catálogo não está na lista de catálogos".into());
    }
    marketplace::fetch_catalog(source).await
}

#[tauri::command]
pub fn list_catalog_sources(app: AppHandle) -> Result<Vec<String>, String> {
    Ok(marketplace::load_sources(&app_data_dir(&app)?)?.urls)
}

/// Baixa e confere o catálogo antes de guardar a URL: endereço ruim ou catálogo inválido não entra na lista.
#[tauri::command]
pub async fn add_catalog_source(app: AppHandle, url: String) -> Result<Catalog, String> {
    marketplace::validate_https(&url)?;
    let catalog = marketplace::fetch_catalog(&url).await?;
    marketplace::add_source(&app_data_dir(&app)?, &url)?;
    Ok(catalog)
}

#[tauri::command]
pub fn remove_catalog_source(app: AppHandle, url: String) -> Result<(), String> {
    marketplace::remove_source(&app_data_dir(&app)?, &url).map(|_| ())
}

#[tauri::command]
pub async fn load_catalog(app: AppHandle, source: String) -> Result<Catalog, String> {
    catalog_of(&app, &source).await
}

/// Baixa os arquivos do plugin, confere os hashes e instala na pasta de plugins (ou troca por versão mais nova).
#[tauri::command]
pub async fn install_catalog_plugin(app: AppHandle, source: String, id: String) -> Result<(), String> {
    let catalog = catalog_of(&app, &source).await?;
    let plugin = catalog
        .plugins
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("o plugin `{id}` não está no catálogo"))?;

    let mut contents = Vec::with_capacity(plugin.files.len());
    for file in &plugin.files {
        let bytes = match (&file.content, &file.url) {
            (Some(text), None) => text.clone().into_bytes(),
            (None, Some(url)) => marketplace::fetch_bytes(url).await?,
            _ => return Err(format!("arquivo `{}` do plugin `{id}` está mal formado", file.path)),
        };
        contents.push((file.path.clone(), bytes));
    }
    marketplace::update_files(&plugins_dir(&app)?, &plugin, &contents)
}

#[tauri::command]
pub fn uninstall_plugin(app: AppHandle, id: String) -> Result<(), String> {
    marketplace::uninstall(&plugins_dir(&app)?, &id)?;
    // Sem a pasta, o estado ligado/desligado deste id não serve para mais nada: volta ao padrão (ligado).
    marketplace::set_enabled(&app_data_dir(&app)?, &id, true).map(|_| ())
}

#[tauri::command]
pub fn get_plugins_state(app: AppHandle) -> Result<PluginsState, String> {
    marketplace::load_state(&app_data_dir(&app)?)
}

#[tauri::command]
pub fn set_plugin_enabled(app: AppHandle, id: String, enabled: bool) -> Result<PluginsState, String> {
    marketplace::set_enabled(&app_data_dir(&app)?, &id, enabled)
}

/// Lê o manifesto de uma pasta escolhida sem instalar, para mostrar as permissões antes.
#[tauri::command]
pub fn inspect_local_plugin(folder: String) -> Result<Manifest, String> {
    local::inspect_folder(Path::new(&folder))
}

/// Instala um plugin de uma pasta escolhida no computador (manifest.json e entry).
#[tauri::command]
pub fn install_local_plugin(app: AppHandle, folder: String) -> Result<Manifest, String> {
    local::install_from_folder(&plugins_dir(&app)?, Path::new(&folder))
}

/// Abre a pasta de plugins no gerenciador de arquivos (cria a pasta se ainda não existir).
#[tauri::command]
pub fn open_plugins_folder(app: AppHandle) -> Result<(), String> {
    let dir = plugins_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("não foi possível criar a pasta de plugins: {e}"))?;
    let program = if cfg!(windows) {
        "explorer"
    } else if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };
    std::process::Command::new(program)
        .arg(&dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("não foi possível abrir {}: {e}", dir.display()))
}

/// Cria um plugin novo com o modelo, na pasta de plugins. Devolve a pasta criada.
#[tauri::command]
pub fn create_plugin(app: AppHandle, id: String, name: String) -> Result<String, String> {
    local::create_plugin(&plugins_dir(&app)?, &id, &name).map(|folder| folder.display().to_string())
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

/// Situação das CLIs (Claude Code e Codex): instaladas ou não, e onde.
#[tauri::command]
pub fn cli_status() -> Vec<setup::CliStatus> {
    vec![setup::status(ProviderKind::Claude), setup::status(ProviderKind::Codex)]
}

/// Roda o instalador oficial da CLI pedida. Demora (baixa o binário), por isso roda fora da thread principal.
#[tauri::command]
pub async fn install_cli(kind: ProviderKind) -> Result<setup::CliStatus, String> {
    tauri::async_runtime::spawn_blocking(move || setup::install(kind))
        .await
        .map_err(|e| format!("a instalação foi interrompida: {e}"))?
}

/// Troca o nome de uma conversa na barra lateral. O nome fica travado: salvar o chat de novo não o desfaz.
#[tauri::command]
pub fn rename_conversation(app: AppHandle, id: String, title: String) -> Result<(), String> {
    conversations::rename(&conversations_dir(&app)?, &id, &title)
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
pub async fn discard_change(cwd: String, path: String, status: String) -> Result<(), String> {
    changes::discard(Path::new(&cwd), &path, &status)
}

/// Arquivos que o @arquivo pode citar no composer, filtrados pelo trecho digitado.
#[tauri::command]
pub async fn list_files(cwd: String, query: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || changes::list_files(Path::new(&cwd), &query))
        .await
        .map_err(|e| format!("falha ao listar os arquivos: {e}"))?
}

/// Salva uma imagem colada ou arrastada na pasta de anexos e devolve o caminho.
/// `data` é o conteúdo em base64. Aceita PNG, JPEG e WebP até 10 MB.
#[tauri::command]
pub fn save_attachment(app: AppHandle, name: String, data: String) -> Result<String, String> {
    let probe = Path::new(&name);
    if image_media_type(probe).is_none() {
        return Err("formato de imagem não suportado: use PNG, JPEG ou WebP".into());
    }
    let bytes = STANDARD
        .decode(data)
        .map_err(|_| "a imagem não chegou inteira; tente de novo".to_string())?;
    if bytes.len() > MAX_ATTACHMENT_BYTES {
        return Err("imagem maior que 10 MB".into());
    }
    let folder = app_data_dir(&app)?.join("attachments");
    std::fs::create_dir_all(&folder).map_err(|e| format!("não foi possível criar a pasta de anexos: {e}"))?;
    let ext = probe
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_ascii_lowercase();
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let file = folder.join(format!("{millis}-{}.{ext}", NEXT_ATTACHMENT.fetch_add(1, Ordering::Relaxed)));
    std::fs::write(&file, &bytes).map_err(|e| format!("não foi possível salvar a imagem: {e}"))?;
    Ok(file.to_string_lossy().into_owned())
}

/// Grava um checkpoint do estado atual antes de um turno. `None` fora de repositório git.
#[tauri::command]
pub async fn checkpoint_take(cwd: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || checkpoints::take(Path::new(&cwd)))
        .await
        .map_err(|e| format!("falha ao gravar o checkpoint: {e}"))?
}

/// Diz o que mudaria ao voltar a um checkpoint, sem mexer nos arquivos.
#[tauri::command]
pub async fn checkpoint_preview(cwd: String, checkpoint: String) -> Result<checkpoints::RestorePreview, String> {
    tauri::async_runtime::spawn_blocking(move || checkpoints::preview(Path::new(&cwd), &checkpoint))
        .await
        .map_err(|e| format!("falha ao comparar o checkpoint: {e}"))?
}

/// Volta os arquivos ao checkpoint. Quem chama confirma antes com o resultado de `checkpoint_preview`.
#[tauri::command]
pub async fn checkpoint_restore(cwd: String, checkpoint: String) -> Result<checkpoints::RestorePreview, String> {
    tauri::async_runtime::spawn_blocking(move || checkpoints::restore(Path::new(&cwd), &checkpoint))
        .await
        .map_err(|e| format!("falha ao restaurar o checkpoint: {e}"))?
}

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

/// Para a execução de uma conversa, se houver.
#[tauri::command]
pub fn cancel_prompt(run_id: String, runs: State<'_, ActiveRuns>) -> Result<(), String> {
    let active = runs.0.lock().expect("lock das execuções ativas");
    match active.get(&run_id) {
        Some(handle) => handle
            .cancel()
            .map_err(|e| format!("não foi possível parar a execução: {e}")),
        None => Ok(()),
    }
}
