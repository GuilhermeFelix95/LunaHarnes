//! Migração do LunaHarness para o LunaCode (identificador novo, `dev.lunacode.app`).
//!
//! Na primeira abertura, antes da janela existir (ver `main.rs`), copia: a pasta de dados (conversas, contas,
//! perfis, plugins, MCP, regras, orquestrador), o WebView (temas, idioma, abas guardadas no navegador do app)
//! e a chave de cada perfil do cofre de credenciais. A pasta e as chaves antigas nunca são apagadas.
//! Um marcador evita repetir; cópia que falha no meio não deixa pasta pela metade (copia para um temporário).

use std::fs;
use std::path::{Path, PathBuf};

pub const OLD_ID: &str = "dev.lunaharness.app";
pub const NEW_ID: &str = "dev.lunacode.app";
/// Serviço do cofre usado pelo LunaHarness. A chave de cada perfil é `profile:<id>`.
pub const OLD_KEYRING_SERVICE: &str = "lunaharness";
const MARKER: &str = "migrated-from-lunaharness";
const PROFILES_FILE: &str = "api-profiles.json";
const WEBVIEW_DIR: &str = "EBWebView";

/// Chaves de perfil no cofre. A implementação real fala com o Gerenciador de Credenciais; o teste usa uma lista em memória.
pub trait KeyStore {
    fn old_key(&self, profile_id: &str) -> Option<String>;
    fn new_key(&self, profile_id: &str) -> Option<String>;
    fn save_new_key(&self, profile_id: &str, key: &str) -> Result<(), String>;
}

/// Pastas de origem e de destino. `*_data` = Roaming (`%APPDATA%`); `*_local` = Local (`%LOCALAPPDATA%`), onde fica o WebView.
pub struct Paths {
    pub old_data: PathBuf,
    pub new_data: PathBuf,
    pub old_local: PathBuf,
    pub new_local: PathBuf,
}

/// Ponto de entrada no Windows. Falha de migração não impede o app de abrir: só é registrada no log.
pub fn run() {
    if !cfg!(windows) {
        return;
    }
    let (Some(roaming), Some(local)) = (std::env::var_os("APPDATA"), std::env::var_os("LOCALAPPDATA")) else {
        return;
    };
    let (roaming, local) = (PathBuf::from(roaming), PathBuf::from(local));
    let paths = Paths {
        old_data: roaming.join(OLD_ID),
        new_data: roaming.join(NEW_ID),
        old_local: local.join(OLD_ID),
        new_local: local.join(NEW_ID),
    };
    if let Err(e) = migrate(&paths, &WindowsVault) {
        eprintln!("Migração do LunaHarness para o LunaCode incompleta: {e}. Os dados antigos continuam na pasta {OLD_ID}.");
    }
}

/// Migra o que falta. Idempotente: com o marcador, não faz nada; sem pasta nova, copia; chave nova existente nunca é trocada.
pub fn migrate(paths: &Paths, keys: &dyn KeyStore) -> Result<(), String> {
    if paths.new_data.join(MARKER).is_file() {
        return Ok(());
    }
    if paths.old_data.is_dir() && !paths.new_data.exists() {
        copy_tree(&paths.old_data, &paths.new_data)?;
    }
    let old_webview = paths.old_local.join(WEBVIEW_DIR);
    if old_webview.is_dir() && !paths.new_local.join(WEBVIEW_DIR).exists() {
        copy_tree(&old_webview, &paths.new_local.join(WEBVIEW_DIR))?;
    }
    for id in profile_ids(&paths.new_data)? {
        if keys.new_key(&id).is_none() {
            if let Some(key) = keys.old_key(&id) {
                keys.save_new_key(&id, &key)?;
            }
        }
    }
    fs::create_dir_all(&paths.new_data).map_err(|e| format!("não foi possível criar {}: {e}", paths.new_data.display()))?;
    fs::write(paths.new_data.join(MARKER), format!("copiado de {OLD_ID}\n"))
        .map_err(|e| format!("não foi possível gravar o marcador da migração: {e}"))
}

/// Ids dos perfis que foram copiados. Sem arquivo de perfis, não há chave para copiar.
fn profile_ids(data: &Path) -> Result<Vec<String>, String> {
    let Ok(text) = fs::read_to_string(data.join(PROFILES_FILE)) else {
        return Ok(Vec::new());
    };
    let value: serde_json::Value = serde_json::from_str(&text).map_err(|e| format!("{PROFILES_FILE} não é JSON válido: {e}"))?;
    Ok(value
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|p| p.get("id").and_then(|id| id.as_str()).map(String::from))
        .collect())
}

/// Copia a árvore inteira. Vai para `<destino>.migrating` e só renomeia quando termina.
fn copy_tree(src: &Path, dst: &Path) -> Result<(), String> {
    let name = dst.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let tmp = dst.with_file_name(format!("{name}.migrating"));
    let _ = fs::remove_dir_all(&tmp);
    copy_dir(src, &tmp)?;
    fs::rename(&tmp, dst).map_err(|e| format!("não foi possível concluir a cópia para {}: {e}", dst.display()))
}

fn copy_dir(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("não foi possível criar {}: {e}", dst.display()))?;
    for entry in fs::read_dir(src).map_err(|e| format!("não foi possível ler {}: {e}", src.display()))? {
        let entry = entry.map_err(|e| format!("não foi possível ler um item de {}: {e}", src.display()))?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if from.is_dir() {
            copy_dir(&from, &to)?;
        } else {
            fs::copy(&from, &to).map_err(|e| format!("não foi possível copiar {}: {e}", from.display()))?;
        }
    }
    Ok(())
}

/// Cofre real do Windows: lê a chave antiga e grava a nova, sem nunca apagar a antiga.
struct WindowsVault;

impl KeyStore for WindowsVault {
    fn old_key(&self, profile_id: &str) -> Option<String> {
        keyring::Entry::new(OLD_KEYRING_SERVICE, &format!("profile:{profile_id}")).ok()?.get_password().ok()
    }

    fn new_key(&self, profile_id: &str) -> Option<String> {
        keyring::Entry::new(crate::api_profiles::KEYRING_SERVICE, &format!("profile:{profile_id}")).ok()?.get_password().ok()
    }

    fn save_new_key(&self, profile_id: &str, key: &str) -> Result<(), String> {
        keyring::Entry::new(crate::api_profiles::KEYRING_SERVICE, &format!("profile:{profile_id}"))
            .and_then(|entry| entry.set_password(key))
            .map_err(|e| format!("não foi possível copiar a chave do perfil `{profile_id}` para o cofre do LunaCode: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::collections::HashMap;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("lunacode-migrate-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn paths(root: &Path) -> Paths {
        Paths {
            old_data: root.join("roaming").join(OLD_ID),
            new_data: root.join("roaming").join(NEW_ID),
            old_local: root.join("local").join(OLD_ID),
            new_local: root.join("local").join(NEW_ID),
        }
    }

    #[derive(Default)]
    struct FakeVault {
        old: HashMap<String, String>,
        new: RefCell<HashMap<String, String>>,
    }

    impl KeyStore for FakeVault {
        fn old_key(&self, id: &str) -> Option<String> {
            self.old.get(id).cloned()
        }
        fn new_key(&self, id: &str) -> Option<String> {
            self.new.borrow().get(id).cloned()
        }
        fn save_new_key(&self, id: &str, key: &str) -> Result<(), String> {
            self.new.borrow_mut().insert(id.into(), key.into());
            Ok(())
        }
    }

    #[test]
    fn copies_the_data_folder_once_and_keeps_the_old_one() {
        let root = temp("copy");
        let p = paths(&root);
        fs::create_dir_all(&p.old_data).unwrap();
        fs::write(p.old_data.join("conversas.json"), "antiga").unwrap();

        migrate(&p, &FakeVault::default()).unwrap();

        assert_eq!(fs::read_to_string(p.new_data.join("conversas.json")).unwrap(), "antiga");
        assert!(p.old_data.join("conversas.json").is_file(), "a pasta antiga não pode ser apagada");
        assert!(p.new_data.join(MARKER).is_file());

        fs::write(p.new_data.join("conversas.json"), "nova").unwrap();
        migrate(&p, &FakeVault::default()).unwrap();
        assert_eq!(fs::read_to_string(p.new_data.join("conversas.json")).unwrap(), "nova", "com o marcador, não copia de novo");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn never_overwrites_a_new_folder_that_already_exists() {
        let root = temp("existing");
        let p = paths(&root);
        fs::create_dir_all(&p.old_data).unwrap();
        fs::write(p.old_data.join("velha.json"), "x").unwrap();
        fs::create_dir_all(&p.new_data).unwrap();
        fs::write(p.new_data.join("nova.json"), "y").unwrap();

        migrate(&p, &FakeVault::default()).unwrap();

        assert!(p.new_data.join("nova.json").is_file());
        assert!(!p.new_data.join("velha.json").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn copies_the_webview_so_saved_themes_and_language_come_along() {
        let root = temp("webview");
        let p = paths(&root);
        fs::create_dir_all(p.old_local.join(WEBVIEW_DIR).join("Default")).unwrap();
        fs::write(p.old_local.join(WEBVIEW_DIR).join("Default").join("Local Storage"), "tema").unwrap();

        migrate(&p, &FakeVault::default()).unwrap();

        assert!(p.new_local.join(WEBVIEW_DIR).join("Default").join("Local Storage").is_file());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn copies_a_profile_key_only_when_the_new_vault_has_none() {
        let root = temp("keys");
        let p = paths(&root);
        fs::create_dir_all(&p.old_data).unwrap();
        fs::write(p.old_data.join(PROFILES_FILE), r#"[{"id":"p1"},{"id":"p2"}]"#).unwrap();
        let vault = FakeVault {
            old: HashMap::from([("p1".to_string(), "sk-1".to_string()), ("p2".to_string(), "sk-2".to_string())]),
            new: RefCell::new(HashMap::from([("p2".to_string(), "ja-estava".to_string())])),
        };

        migrate(&p, &vault).unwrap();

        assert_eq!(vault.new.borrow().get("p1").map(String::as_str), Some("sk-1"));
        assert_eq!(vault.new.borrow().get("p2").map(String::as_str), Some("ja-estava"));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn without_an_old_install_it_just_marks_the_migration_done() {
        let root = temp("fresh");
        let p = paths(&root);

        migrate(&p, &FakeVault::default()).unwrap();

        assert!(p.new_data.join(MARKER).is_file());
        assert!(!p.new_data.join(PROFILES_FILE).exists());
        let _ = fs::remove_dir_all(&root);
    }
}
