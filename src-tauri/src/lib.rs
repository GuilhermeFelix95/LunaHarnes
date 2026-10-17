pub mod commands;
pub mod providers;
pub mod session;

/// Ponto de entrada do app Tauri.
pub fn run() {
    tauri::Builder::default()
        .manage(commands::ActiveRun::default())
        .invoke_handler(tauri::generate_handler![
            commands::send_prompt,
            commands::cancel_prompt
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o LunaHarness");
}
