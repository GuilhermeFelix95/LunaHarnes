pub mod api_profiles;
pub mod auth;
pub mod changes;
pub mod checkpoints;
pub mod commands;
pub mod conversations;
pub mod models;
pub mod plugins;
pub mod providers;
pub mod session;
pub mod setup;
pub mod slash;
pub mod spec;
pub mod terminal;

/// Ponto de entrada do app Tauri.
pub fn run() {
    tauri::Builder::default()
        .manage(commands::ActiveRuns::default())
        .manage(terminal::Terminals::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            use tauri::Manager;
            // Grava o guia de plugins para a Luna ler. Sem ele o app segue, só sem o guia.
            match app.path().app_data_dir() {
                Ok(dir) => {
                    if let Err(e) = plugins::guide::install(&dir) {
                        eprintln!("não foi possível gravar o guia de plugins em {}: {e}", dir.display());
                    }
                }
                Err(e) => eprintln!("não foi possível localizar a pasta de dados para o guia de plugins: {e}"),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::send_prompt,
            commands::cancel_prompt,
            commands::list_plugins,
            commands::read_plugin_entry,
            commands::check_auth,
            commands::list_models,
            commands::get_changes,
            commands::get_file_diff,
            commands::discard_change,
            commands::checkpoint_take,
            commands::list_files,
            slash::list_slash_items,
            commands::save_attachment,
            commands::checkpoint_preview,
            commands::checkpoint_restore,
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
            commands::rename_conversation,
            commands::cli_status,
            commands::install_cli,
            commands::api_presets,
            commands::list_api_profiles,
            commands::save_api_profile,
            commands::delete_api_profile,
            commands::set_api_profile_key,
            commands::api_profile_has_key,
            commands::test_api_profile,
            commands::refresh_api_models,
            commands::list_provider_models,
            commands::list_catalog_sources,
            commands::add_catalog_source,
            commands::remove_catalog_source,
            commands::load_catalog,
            commands::install_catalog_plugin,
            commands::uninstall_plugin,
            commands::get_plugins_state,
            commands::set_plugin_enabled,
            commands::inspect_local_plugin,
            commands::install_local_plugin,
            commands::create_plugin,
            commands::open_plugins_folder
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o LunaHarness");
}
