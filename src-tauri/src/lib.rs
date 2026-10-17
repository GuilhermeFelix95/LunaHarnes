pub mod api_profiles;
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
            commands::delete_conversation,
            commands::api_presets,
            commands::list_api_profiles,
            commands::save_api_profile,
            commands::delete_api_profile,
            commands::set_api_profile_key,
            commands::api_profile_has_key,
            commands::test_api_profile,
            commands::list_catalog_sources,
            commands::add_catalog_source,
            commands::remove_catalog_source,
            commands::load_catalog,
            commands::install_catalog_plugin,
            commands::uninstall_plugin,
            commands::get_plugins_state,
            commands::set_plugin_enabled
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o LunaHarness");
}
