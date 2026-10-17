pub mod auth;
pub mod commands;
pub mod plugins;
pub mod providers;
pub mod session;

/// Ponto de entrada do app Tauri.
pub fn run() {
    tauri::Builder::default()
        .manage(commands::ActiveRun::default())
        .invoke_handler(tauri::generate_handler![
            commands::send_prompt,
            commands::cancel_prompt,
            commands::list_plugins,
            commands::read_plugin_entry,
            commands::check_auth,
            commands::open_login
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o LunaHarness");
}
