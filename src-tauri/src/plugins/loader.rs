use std::fs;
use std::path::{Component, Path};

use serde::{Deserialize, Serialize};

/// Permissões que o host sabe conceder. Qualquer outra recusa o plugin.
/// `modes` só permite registrar modos que restringem (somente leitura); nunca amplia permissão.
pub const KNOWN_PERMISSIONS: &[&str] = &["commands", "hooks", "modes", "cache"];

/// Conteúdo de `manifest.json`. A pasta do plugin precisa ter o mesmo nome do `id`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Manifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub entry: String,
    #[serde(default)]
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PluginError {
    pub folder: String,
    pub message: String,
}

#[derive(Debug, Default, PartialEq, Serialize)]
pub struct PluginScan {
    pub plugins: Vec<Manifest>,
    pub errors: Vec<PluginError>,
}

/// Valida o manifesto e confere se ele corresponde à pasta onde foi encontrado.
pub fn validate(manifest: &Manifest, folder: &str) -> Result<(), String> {
    if !is_valid_id(&manifest.id) {
        return Err(format!(
            "id `{}` inválido: use letras minúsculas, números e hífen, sem começar com hífen",
            manifest.id
        ));
    }
    if manifest.id != folder {
        return Err(format!(
            "id `{}` precisa ser igual ao nome da pasta `{folder}`",
            manifest.id
        ));
    }
    if manifest.name.trim().is_empty() {
        return Err("name é obrigatório".into());
    }
    if !is_safe_relative(&manifest.entry) {
        return Err(format!(
            "entry `{}` precisa ser um caminho relativo dentro da pasta do plugin",
            manifest.entry
        ));
    }
    if let Some(unknown) = manifest
        .permissions
        .iter()
        .find(|p| !KNOWN_PERMISSIONS.contains(&p.as_str()))
    {
        return Err(format!("permissão desconhecida `{unknown}`"));
    }
    Ok(())
}

/// Lista todos os plugins de `plugins_dir`. Um plugin inválido não derruba os outros:
/// o erro vai para `errors` e o restante carrega normalmente.
pub fn scan(plugins_dir: &Path) -> PluginScan {
    let mut result = PluginScan::default();
    let Ok(entries) = fs::read_dir(plugins_dir) else {
        return result;
    };

    for entry in entries.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let folder = entry.file_name().to_string_lossy().into_owned();
        match read_manifest(plugins_dir, &folder) {
            Ok(manifest) => result.plugins.push(manifest),
            Err(message) => result.errors.push(PluginError { folder, message }),
        }
    }

    result.plugins.sort_by(|a, b| a.id.cmp(&b.id));
    result
}

/// Lê o arquivo de entrada de um plugin já validado.
pub fn read_entry(plugins_dir: &Path, id: &str) -> Result<String, String> {
    let manifest = read_manifest(plugins_dir, id)?;
    let file = plugins_dir.join(id).join(&manifest.entry);
    fs::read_to_string(&file).map_err(|e| {
        format!(
            "não foi possível ler o entry `{}` do plugin `{id}`: {e}",
            manifest.entry
        )
    })
}

fn read_manifest(plugins_dir: &Path, folder: &str) -> Result<Manifest, String> {
    // Checar o nome da pasta antes de montar o caminho impede travessia (`../`).
    if !is_valid_id(folder) {
        return Err(format!("nome de pasta `{folder}` inválido para um plugin"));
    }

    let file = plugins_dir.join(folder).join("manifest.json");
    let text = fs::read_to_string(&file)
        .map_err(|e| format!("não foi possível ler {}: {e}", file.display()))?;
    let manifest: Manifest =
        serde_json::from_str(&text).map_err(|e| format!("manifest.json inválido: {e}"))?;
    validate(&manifest, folder)?;
    Ok(manifest)
}

pub(crate) fn is_valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && !id.starts_with('-')
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

pub(crate) fn is_safe_relative(path: &str) -> bool {
    !path.is_empty()
        && Path::new(path)
            .components()
            .all(|c| matches!(c, Component::Normal(_)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    /// Cria uma pasta de plugins isolada para cada teste.
    fn temp_plugins_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "lunaharness-plugins-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_plugin(dir: &Path, folder: &str, manifest: &str) {
        let plugin = dir.join(folder);
        fs::create_dir_all(&plugin).unwrap();
        fs::write(plugin.join("manifest.json"), manifest).unwrap();
        fs::write(plugin.join("index.js"), "export function activate() {}").unwrap();
    }

    const VALID: &str = r#"{"id":"hello","name":"Hello","version":"0.1.0","entry":"index.js","permissions":["commands","hooks"]}"#;

    #[test]
    fn scans_valid_plugin() {
        let dir = temp_plugins_dir("valid");
        write_plugin(&dir, "hello", VALID);

        let scan = scan(&dir);

        assert!(scan.errors.is_empty());
        assert_eq!(scan.plugins.len(), 1);
        assert_eq!(scan.plugins[0].id, "hello");
    }

    #[test]
    fn accepts_cache_permission() {
        let dir = temp_plugins_dir("cache-permission");
        write_plugin(
            &dir,
            "hello",
            r#"{"id":"hello","name":"Hello","version":"0.1.0","entry":"index.js","permissions":["cache"]}"#,
        );

        let scan = scan(&dir);

        assert!(scan.errors.is_empty());
        assert_eq!(scan.plugins.len(), 1);
    }

    #[test]
    fn id_must_match_folder_name() {
        let dir = temp_plugins_dir("mismatch");
        write_plugin(&dir, "outra-pasta", VALID);

        let scan = scan(&dir);

        assert!(scan.plugins.is_empty());
        assert!(scan.errors[0].message.contains("precisa ser igual ao nome da pasta"));
    }

    #[test]
    fn rejects_entry_outside_plugin_folder() {
        let dir = temp_plugins_dir("traversal-entry");
        write_plugin(
            &dir,
            "hello",
            r#"{"id":"hello","name":"Hello","version":"0.1.0","entry":"../segredo.js"}"#,
        );

        let scan = scan(&dir);

        assert!(scan.plugins.is_empty());
        assert!(scan.errors[0].message.contains("caminho relativo"));
    }

    #[test]
    fn rejects_unknown_permission() {
        let dir = temp_plugins_dir("permission");
        write_plugin(
            &dir,
            "hello",
            r#"{"id":"hello","name":"Hello","version":"0.1.0","entry":"index.js","permissions":["filesystem"]}"#,
        );

        let scan = scan(&dir);

        assert!(scan.errors[0].message.contains("permissão desconhecida `filesystem`"));
    }

    #[test]
    fn invalid_plugin_does_not_block_valid_ones() {
        let dir = temp_plugins_dir("isolation");
        write_plugin(&dir, "hello", VALID);
        write_plugin(&dir, "quebrado", "{ isto não é json");

        let scan = scan(&dir);

        assert_eq!(scan.plugins.len(), 1);
        assert_eq!(scan.errors.len(), 1);
        assert_eq!(scan.errors[0].folder, "quebrado");
    }

    #[test]
    fn read_entry_rejects_path_traversal_in_id() {
        let dir = temp_plugins_dir("traversal-id");

        let result = read_entry(&dir, "../fora");

        assert!(result.unwrap_err().contains("inválido"));
    }

    #[test]
    fn read_entry_returns_source_of_valid_plugin() {
        let dir = temp_plugins_dir("read-entry");
        write_plugin(&dir, "hello", VALID);

        let source = read_entry(&dir, "hello").unwrap();

        assert_eq!(source, "export function activate() {}");
    }
}
