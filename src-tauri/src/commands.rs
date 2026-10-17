use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};

use crate::providers::ProviderKind;
use crate::session::{CancelHandle, Session};

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
    provider: ProviderKind,
    prompt: String,
) -> Result<(), String> {
    let mut active = run.0.lock().expect("lock da execução ativa");
    if active.is_some() {
        return Err("já existe uma resposta em andamento; aguarde ou pare antes de enviar outra".into());
    }

    let mut session = Session::start(provider, &prompt)?;
    *active = Some(session.cancel_handle());
    drop(active);

    std::thread::spawn(move || {
        session.pump(provider, |event| {
            // Falha ao emitir só acontece se a janela já foi fechada; nada a fazer.
            let _ = app.emit(PROVIDER_EVENT, event);
        });
        if let Err(e) = session.wait() {
            eprintln!("lunaharness: falha ao aguardar o fim do CLI: {e}");
        }

        let run = app.state::<ActiveRun>();
        *run.0.lock().expect("lock da execução ativa") = None;
    });

    Ok(())
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
