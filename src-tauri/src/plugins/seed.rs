//! Plugins que vêm instalados por padrão, do catálogo oficial embutido (conteúdo verificado por sha256).
//! Cada um entra uma vez. O marcador em `<app_data>/plugins-seeded/<id>` diz que a instalação já foi feita:
//! se a pessoa desinstalar depois, o marcador impede o app de instalar de novo sem ela pedir.
use std::fs;
use std::path::Path;

use super::marketplace::{self, Catalog};

/// Ids do catálogo oficial que entram por padrão.
pub const DEFAULT_PLUGINS: &[&str] = &["lunafix"];

/// Instala os plugins padrão que ainda não foram semeados. Falha de um não impede os outros.
pub fn install_defaults(app_data: &Path) -> Result<(), String> {
    let catalog = marketplace::official()?;
    install_from(app_data, &catalog, DEFAULT_PLUGINS)
}

fn install_from(app_data: &Path, catalog: &Catalog, ids: &[&str]) -> Result<(), String> {
    let plugins_dir = app_data.join("plugins");
    let markers = app_data.join("plugins-seeded");
    let mut failures = Vec::new();

    for id in ids {
        let marker = markers.join(id);
        if marker.exists() {
            continue;
        }
        let result = install_one(&plugins_dir, catalog, id);
        match result {
            Ok(()) => {
                if let Err(e) = write_marker(&markers, &marker) {
                    failures.push(format!("{id}: {e}"));
                }
            }
            Err(e) => failures.push(format!("{id}: {e}")),
        }
    }

    if failures.is_empty() {
        Ok(())
    } else {
        Err(format!("não foi possível instalar os plugins padrão: {}", failures.join("; ")))
    }
}

fn install_one(plugins_dir: &Path, catalog: &Catalog, id: &str) -> Result<(), String> {
    let plugin = catalog
        .plugins
        .iter()
        .find(|p| p.id == id)
        .ok_or_else(|| "não está no catálogo oficial".to_string())?;
    let mut contents = Vec::with_capacity(plugin.files.len());
    for file in &plugin.files {
        let text = file
            .content
            .as_ref()
            .ok_or_else(|| format!("arquivo {} sem conteúdo embutido", file.path))?;
        contents.push((file.path.clone(), text.clone().into_bytes()));
    }
    // Já instalado numa versão igual ou mais nova: nada a fazer. Numa versão mais antiga (ex.: o plugin de cache de respostas), troca pela atual.
    match marketplace::installed_version(plugins_dir, id) {
        Some(current) if !marketplace::is_newer(&plugin.version, &current) => Ok(()),
        Some(_) => marketplace::update_files(plugins_dir, plugin, &contents),
        None => marketplace::install_files(plugins_dir, plugin, &contents),
    }
}

fn write_marker(markers: &Path, marker: &Path) -> Result<(), String> {
    fs::create_dir_all(markers).map_err(|e| format!("não foi possível criar {}: {e}", markers.display()))?;
    fs::write(marker, "").map_err(|e| format!("não foi possível gravar {}: {e}", marker.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_app(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("lunaharness-seed-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// O plugin de cache de tokens saiu dos padrões e do catálogo: nada o instala de novo.
    #[test]
    fn cache_tokens_is_no_longer_a_default_plugin() {
        assert!(!DEFAULT_PLUGINS.contains(&"cache-tokens"));
        let catalog = marketplace::official().unwrap();
        assert!(catalog.plugins.iter().all(|p| p.id != "cache-tokens"));
    }

    #[test]
    fn installs_the_default_plugin_once_and_respects_its_removal() {
        let app = temp_app("once");
        let catalog = marketplace::official().unwrap();

        install_from(&app, &catalog, &["lunafix"]).unwrap();
        assert!(app.join("plugins/lunafix/index.js").is_file());
        assert!(app.join("plugins-seeded/lunafix").is_file());

        // A pessoa desinstala: a próxima abertura do app não pode trazer o plugin de volta.
        marketplace::uninstall(&app.join("plugins"), "lunafix").unwrap();
        install_from(&app, &catalog, &["lunafix"]).unwrap();
        assert!(!app.join("plugins/lunafix").exists());

        let _ = fs::remove_dir_all(&app);
    }

    /// LunaFix vem ativo por padrão: a lista de padrões inclui o plugin e o catálogo oficial o traz.
    #[test]
    fn lunafix_is_a_default_plugin_shipped_in_the_catalog() {
        assert!(DEFAULT_PLUGINS.contains(&"lunafix"));
        let app = temp_app("lunafix-padrao");
        let catalog = marketplace::official().unwrap();
        install_from(&app, &catalog, &["lunafix"]).unwrap();
        assert!(app.join("plugins/lunafix/index.js").is_file());
    }

    #[test]
    fn an_older_install_of_the_default_plugin_is_replaced_by_the_catalog_version() {
        let app = temp_app("older");
        let catalog = marketplace::official().unwrap();
        let catalog_version = catalog.plugins.iter().find(|p| p.id == "lunafix").unwrap().version.clone();
        let folder = app.join("plugins/lunafix");
        fs::create_dir_all(&folder).unwrap();
        fs::write(folder.join("manifest.json"), r#"{"id":"lunafix","version":"0.0.1","entry":"index.js"}"#).unwrap();
        fs::write(folder.join("index.js"), "// versão antiga").unwrap();

        install_from(&app, &catalog, &["lunafix"]).unwrap();

        let installed = fs::read_to_string(folder.join("index.js")).unwrap();
        assert_ne!(installed, "// versão antiga");
        assert_eq!(marketplace::installed_version(&app.join("plugins"), "lunafix").as_deref(), Some(catalog_version.as_str()));

        let _ = fs::remove_dir_all(&app);
    }

    #[test]
    fn a_plugin_missing_from_the_catalog_is_reported_and_leaves_no_marker() {
        let app = temp_app("missing");
        let catalog = marketplace::official().unwrap();

        let err = install_from(&app, &catalog, &["nao-existe"]).unwrap_err();
        assert!(err.contains("nao-existe"));
        assert!(!app.join("plugins-seeded/nao-existe").exists());

        let _ = fs::remove_dir_all(&app);
    }
}
