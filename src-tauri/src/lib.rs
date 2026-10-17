pub mod auth;
pub mod changes;
pub mod commands;
pub mod conversations;
pub mod models;
pub mod plugins;
pub mod providers;
pub mod session;
pub mod terminal;

/// Ponto de entrada do app Tauri.
pub fn run() {
    tauri::Builder::default()
        .manage(commands::ActiveRun::default())
        .manage(terminal::Terminals::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::send_prompt,
            commands::cancel_prompt,
            commands::list_plugins,
            commands::read_plugin_entry,
            commands::check_auth,
            commands::list_models,
            commands::get_changes,
            commands::get_file_diff,
            commands::terminal_open,
            commands::terminal_write,
            commands::terminal_resize,
            commands::terminal_close,
            commands::open_login,
            commands::get_workspace,
            commands::list_conversations,
            commands::load_conversation,
            commands::save_conversation,
            commands::delete_conversation
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o LunaHarness");
}
