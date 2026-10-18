//! Marketplace de plugins: catálogos, instalação com verificação de sha256 e desinstalação.
//!
//! Um catálogo é um JSON com a lista de plugins. Cada arquivo traz o `sha256` esperado e vem de um
//! de dois lugares: `content` (texto dentro do próprio catálogo, usado pelo catálogo oficial embutido)
//! ou `url` (HTTPS, usado pelos catálogos adicionados pelo usuário). Nada é instalado sem o hash bater.
//!
//! Instalar grava numa pasta de preparo e só depois renomeia para `<app_data>/plugins/<id>`,
//! então uma falha no meio não deixa um plugin pela metade.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use super::loader::{self, Manifest};

/// Catálogo oficial, embutido no binário. O conteúdo de cada arquivo está dentro dele.
pub const OFFICIAL_CATALOG: &str = include_str!("../../marketplace/official.json");
const SOURCES_FILE: &str = "catalogs.json";
const STATE_FILE: &str = "plugins-state.json";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub name: String,
    pub plugins: Vec<CatalogPlugin>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogPlugin {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub author: String,
    pub version: String,
    pub entry: String,
    #[serde(default)]
    pub permissions: Vec<String>,
    pub files: Vec<CatalogFile>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogFile {
    pub path: String,
    pub sha256: String,
    /// Conteúdo do arquivo (catálogo oficial). Use `content` ou `url`, nunca os dois.
    #[serde(default)]
    pub content: Option<String>,
    /// Endereço HTTPS do arquivo (catálogos por URL).
    #[serde(default)]
    pub url: Option<String>,
}

/// Estado dos plugins: os desativados. Ausente = todos ativos.
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginsState {
    #[serde(default)]
    pub disabled: Vec<String>,
}

pub use crate::marketplace::{fetch_bytes, sha256_hex, validate_https, verify, CatalogSources};

fn manifest_of(plugin: &CatalogPlugin) -> Manifest {
    Manifest {
        id: plugin.id.clone(),
        name: plugin.name.clone(),
        version: plugin.version.clone(),
        entry: plugin.entry.clone(),
        permissions: plugin.permissions.clone(),
    }
}

/// Confere um plugin do catálogo com as mesmas regras de um plugin instalado.
fn validate_plugin(plugin: &CatalogPlugin) -> Result<(), String> {
    loader::validate(&manifest_of(plugin), &plugin.id)?;
    if !plugin.files.iter().any(|f| f.path == plugin.entry) {
        return Err(format!("plugin `{}`: entry `{}` não está na lista de arquivos", plugin.id, plugin.entry));
    }
    for file in &plugin.files {
        if !loader::is_safe_relative(&file.path) || file.path == "manifest.json" {
            return Err(format!("plugin `{}`: caminho de arquivo inválido `{}`", plugin.id, file.path));
        }
        if !is_sha256(&file.sha256) {
            return Err(format!("plugin `{}`: sha256 de `{}` precisa ter 64 caracteres hexadecimais", plugin.id, file.path));
        }
        match (&file.content, &file.url) {
            (Some(_), None) => {}
            (None, Some(url)) => validate_https(url)?,
            _ => return Err(format!("plugin `{}`: `{}` precisa de content ou url, e só um dos dois", plugin.id, file.path)),
        }
    }
    Ok(())
}

/// Lê e confere um catálogo. Qualquer plugin inválido recusa o catálogo inteiro.
pub fn parse_catalog(text: &str) -> Result<Catalog, String> {
    if text.len() > crate::marketplace::MAX_BYTES {
        return Err("o catálogo passa de 1 MB".into());
    }
    let catalog: Catalog = serde_json::from_str(text).map_err(|e| format!("catálogo inválido: {e}"))?;
    for plugin in &catalog.plugins {
        validate_plugin(plugin)?;
    }
    let mut ids: Vec<&str> = catalog.plugins.iter().map(|p| p.id.as_str()).collect();
    ids.sort_unstable();
    if let Some(dup) = ids.windows(2).find(|pair| pair[0] == pair[1]) {
        return Err(format!("o catálogo tem o plugin `{}` mais de uma vez", dup[0]));
    }
    Ok(catalog)
}

/// Catálogo oficial embutido. Falha só se o binário foi gerado com um catálogo quebrado.
pub fn official() -> Result<Catalog, String> {
    parse_catalog(OFFICIAL_CATALOG)
}

fn is_sha256(value: &str) -> bool {
    value.len() == 64 && value.chars().all(|c| c.is_ascii_hexdigit())
}

/// Baixa e confere um catálogo por URL.
pub async fn fetch_catalog(url: &str) -> Result<Catalog, String> {
    let bytes = fetch_bytes(url).await?;
    let text = String::from_utf8(bytes).map_err(|_| format!("{url} não é texto UTF-8"))?;
    parse_catalog(&text)
}

/// Grava um plugin já baixado. `contents` traz (caminho, bytes) de cada arquivo da lista do plugin.
/// Confere todos os hashes antes de escrever qualquer coisa.
pub fn install_files(plugins_dir: &Path, plugin: &CatalogPlugin, contents: &[(String, Vec<u8>)]) -> Result<(), String> {
    validate_plugin(plugin)?;
    let target = plugins_dir.join(&plugin.id);
    if target.exists() {
        return Err(format!("o plugin `{}` já está instalado", plugin.id));
    }

    for file in &plugin.files {
        let bytes = contents
            .iter()
            .find(|(path, _)| path == &file.path)
            .map(|(_, bytes)| bytes.as_slice())
            .ok_or_else(|| format!("o arquivo `{}` não foi baixado", file.path))?;
        verify(&file.path, bytes, &file.sha256)?;
    }

    // Preparo fora da pasta de plugins, para o scanner nunca ver uma instalação pela metade.
    let staging_root = plugins_dir.parent().unwrap_or(plugins_dir);
    let staging = staging_root.join(format!("plugin-staging-{}", plugin.id));
    let _ = fs::remove_dir_all(&staging);
    let result = write_staged(&staging, plugin, contents)
        .and_then(|()| {
            fs::create_dir_all(plugins_dir).map_err(|e| format!("não foi possível criar a pasta de plugins: {e}"))?;
            fs::rename(&staging, &target).map_err(|e| format!("não foi possível concluir a instalação: {e}"))
        });
    if result.is_err() {
        let _ = fs::remove_dir_all(&staging);
    }
    result
}

fn write_staged(staging: &Path, plugin: &CatalogPlugin, contents: &[(String, Vec<u8>)]) -> Result<(), String> {
    fs::create_dir_all(staging).map_err(|e| format!("não foi possível preparar a instalação: {e}"))?;
    for file in &plugin.files {
        let bytes = contents
            .iter()
            .find(|(path, _)| path == &file.path)
            .map(|(_, bytes)| bytes)
            .ok_or_else(|| format!("o arquivo `{}` não foi baixado", file.path))?;
        let dest = staging.join(&file.path);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("não foi possível criar a pasta de `{}`: {e}", file.path))?;
        }
        fs::write(&dest, bytes).map_err(|e| format!("não foi possível gravar `{}`: {e}", file.path))?;
    }
    let manifest = serde_json::to_string_pretty(&manifest_of(plugin))
        .map_err(|e| format!("falha ao gerar o manifest.json: {e}"))?;
    fs::write(staging.join("manifest.json"), manifest).map_err(|e| format!("não foi possível gravar manifest.json: {e}"))
}

/// Remove só a pasta do plugin. Os demais arquivos da pasta de plugins ficam como estão.
pub fn uninstall(plugins_dir: &Path, id: &str) -> Result<(), String> {
    if !loader::is_valid_id(id) {
        return Err(format!("id de plugin inválido: {id:?}"));
    }
    let target = plugins_dir.join(id);
    if !target.is_dir() {
        return Err(format!("o plugin `{id}` não está instalado"));
    }
    fs::remove_dir_all(&target).map_err(|e| format!("não foi possível remover `{id}`: {e}"))
}

/// Versão instalada (campo `version` do manifest.json da pasta), se o plugin estiver instalado.
pub fn installed_version(plugins_dir: &Path, id: &str) -> Option<String> {
    let text = fs::read_to_string(plugins_dir.join(id).join("manifest.json")).ok()?;
    let manifest: serde_json::Value = serde_json::from_str(&text).ok()?;
    manifest.get("version")?.as_str().map(String::from)
}

/// Compara versões pelos números: 0.10.0 é mais nova que 0.9.0. Parte que não é número conta como 0.
pub fn is_newer(candidate: &str, current: &str) -> bool {
    let parts = |v: &str| -> Vec<u64> { v.split('.').map(|p| p.parse().unwrap_or(0)).collect() };
    let (a, b) = (parts(candidate), parts(current));
    for i in 0..a.len().max(b.len()) {
        let (x, y) = (a.get(i).copied().unwrap_or(0), b.get(i).copied().unwrap_or(0));
        if x != y {
            return x > y;
        }
    }
    false
}

/// Instala ou atualiza. Um plugin já instalado só é trocado por versão mais nova.
/// A pasta antiga fica de lado até a nova estar no lugar; se a troca falhar, ela volta.
pub fn update_files(plugins_dir: &Path, plugin: &CatalogPlugin, contents: &[(String, Vec<u8>)]) -> Result<(), String> {
    let Some(current) = installed_version(plugins_dir, &plugin.id) else {
        return install_files(plugins_dir, plugin, contents);
    };
    if !is_newer(&plugin.version, &current) {
        return Err(format!("o plugin `{}` já está na versão {current}", plugin.id));
    }
    validate_plugin(plugin)?;

    let target = plugins_dir.join(&plugin.id);
    let backup = plugins_dir.parent().unwrap_or(plugins_dir).join(format!("plugin-backup-{}", plugin.id));
    let _ = fs::remove_dir_all(&backup);
    fs::rename(&target, &backup).map_err(|e| format!("não foi possível trocar `{}`: {e}", plugin.id))?;
    match install_files(plugins_dir, plugin, contents) {
        Ok(()) => {
            let _ = fs::remove_dir_all(&backup);
            Ok(())
        }
        Err(e) => {
            let _ = fs::remove_dir_all(&target);
            fs::rename(&backup, &target).map_err(|r| format!("{e}; e a versão anterior não pôde ser restaurada: {r}"))?;
            Err(e)
        }
    }
}

fn read_json<T: Default + for<'de> Deserialize<'de>>(path: &Path) -> Result<T, String> {
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!("{} está corrompido: {e}", path.display())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(T::default()),
        Err(e) => Err(format!("não foi possível ler {}: {e}", path.display())),
    }
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("não foi possível criar a pasta de dados: {e}"))?;
    }
    let text = serde_json::to_string_pretty(value).map_err(|e| format!("falha ao gerar {}: {e}", path.display()))?;
    fs::write(path, text).map_err(|e| format!("não foi possível gravar {}: {e}", path.display()))
}

pub fn load_state(app_dir: &Path) -> Result<PluginsState, String> {
    read_json(&app_dir.join(STATE_FILE))
}

/// Liga ou desliga um plugin instalado. Desligado, ele não é carregado no próximo início do chat.
pub fn set_enabled(app_dir: &Path, id: &str, enabled: bool) -> Result<PluginsState, String> {
    if !loader::is_valid_id(id) {
        return Err(format!("id de plugin inválido: {id:?}"));
    }
    let mut state = load_state(app_dir)?;
    state.disabled.retain(|d| d != id);
    if !enabled {
        state.disabled.push(id.to_string());
        state.disabled.sort();
    }
    write_json(&app_dir.join(STATE_FILE), &state)?;
    Ok(state)
}

/// Recusa a leitura do código de um plugin desligado. É a última barreira: o host também não carrega.
pub fn ensure_enabled(app_dir: &Path, id: &str) -> Result<(), String> {
    if load_state(app_dir)?.disabled.iter().any(|d| d == id) {
        return Err(format!("o plugin `{id}` está desligado"));
    }
    Ok(())
}

pub fn load_sources(app_dir: &Path) -> Result<CatalogSources, String> {
    crate::marketplace::load_sources_in(app_dir, SOURCES_FILE)
}

/// Adiciona um catálogo por URL. A conferência (download e leitura) é feita antes, pelo comando.
pub fn add_source(app_dir: &Path, url: &str) -> Result<CatalogSources, String> {
    crate::marketplace::add_source_in(app_dir, SOURCES_FILE, url)
}

pub fn remove_source(app_dir: &Path, url: &str) -> Result<CatalogSources, String> {
    crate::marketplace::remove_source_in(app_dir, SOURCES_FILE, url)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("luna-marketplace-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn plugin(content: &str) -> CatalogPlugin {
        CatalogPlugin {
            id: "exemplo".into(),
            name: "Exemplo".into(),
            description: String::new(),
            author: String::new(),
            version: "0.1.0".into(),
            entry: "index.js".into(),
            permissions: vec!["modes".into()],
            files: vec![CatalogFile {
                path: "index.js".into(),
                sha256: sha256_hex(content.as_bytes()),
                content: Some(content.into()),
                url: None,
            }],
        }
    }

    #[test]
    fn official_catalog_is_valid_and_every_hash_matches_its_content() {
        let catalog = official().expect("o catálogo oficial embutido precisa ser válido");

        assert!(catalog.plugins.iter().any(|p| p.id == "ask-mode"));
        for plugin in &catalog.plugins {
            for file in &plugin.files {
                let content = file.content.as_deref().expect("catálogo oficial traz o conteúdo");
                assert_eq!(sha256_hex(content.as_bytes()), file.sha256, "hash de {} em {}", file.path, plugin.id);
            }
        }
    }

    #[test]
    fn install_refuses_a_file_whose_hash_does_not_match() {
        let dir = temp_dir("hash");
        let mut bad = plugin("codigo original");
        bad.files[0].sha256 = sha256_hex(b"outro codigo");

        let err = install_files(&dir, &bad, &[("index.js".into(), b"codigo original".to_vec())]).unwrap_err();

        assert!(err.contains("não bate com o sha256"));
        assert!(!dir.join("exemplo").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn install_writes_manifest_and_files_then_uninstall_removes_only_that_plugin() {
        let root = temp_dir("install");
        let plugins = root.join("plugins");
        let content = "export function activate() {}";
        let item = plugin(content);

        install_files(&plugins, &item, &[("index.js".into(), content.as_bytes().to_vec())]).unwrap();
        assert!(plugins.join("exemplo").join("index.js").is_file());
        assert!(plugins.join("exemplo").join("manifest.json").is_file());
        assert!(!root.join("plugin-staging-exemplo").exists());

        // Outro plugin ao lado não é tocado.
        fs::create_dir_all(plugins.join("outro")).unwrap();
        fs::write(plugins.join("outro").join("index.js"), "x").unwrap();

        uninstall(&plugins, "exemplo").unwrap();
        assert!(!plugins.join("exemplo").exists());
        assert!(plugins.join("outro").join("index.js").is_file());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn install_refuses_a_plugin_that_is_already_there() {
        let plugins = temp_dir("twice").join("plugins");
        let content = "x";
        let item = plugin(content);
        install_files(&plugins, &item, &[("index.js".into(), content.as_bytes().to_vec())]).unwrap();

        let err = install_files(&plugins, &item, &[("index.js".into(), content.as_bytes().to_vec())]).unwrap_err();
        assert!(err.contains("já está instalado"));
        let _ = fs::remove_dir_all(plugins.parent().unwrap());
    }

    #[test]
    fn versions_compare_by_number_not_by_text() {
        assert!(is_newer("0.10.0", "0.9.0"));
        assert!(is_newer("0.2.0", "0.1.0"));
        assert!(!is_newer("0.2.0", "0.2.0"));
        assert!(!is_newer("0.1.0", "0.2.0"));
    }

    #[test]
    fn update_replaces_an_older_install_and_removes_the_backup() {
        let plugins = temp_dir("update").join("plugins");
        install_files(&plugins, &plugin("antigo"), &[("index.js".into(), b"antigo".to_vec())]).unwrap();
        let mut newer = plugin("novo");
        newer.version = "0.2.0".into();

        update_files(&plugins, &newer, &[("index.js".into(), b"novo".to_vec())]).unwrap();

        assert_eq!(fs::read_to_string(plugins.join("exemplo").join("index.js")).unwrap(), "novo");
        assert_eq!(installed_version(&plugins, "exemplo").as_deref(), Some("0.2.0"));
        assert!(!plugins.parent().unwrap().join("plugin-backup-exemplo").exists());
        let _ = fs::remove_dir_all(plugins.parent().unwrap());
    }

    #[test]
    fn update_keeps_the_old_install_when_the_new_files_fail_the_hash() {
        let plugins = temp_dir("update-fail").join("plugins");
        install_files(&plugins, &plugin("antigo"), &[("index.js".into(), b"antigo".to_vec())]).unwrap();
        let mut newer = plugin("novo");
        newer.version = "0.2.0".into();

        assert!(update_files(&plugins, &newer, &[("index.js".into(), b"adulterado".to_vec())]).is_err());

        assert_eq!(fs::read_to_string(plugins.join("exemplo").join("index.js")).unwrap(), "antigo");
        let _ = fs::remove_dir_all(plugins.parent().unwrap());
    }

    #[test]
    fn update_refuses_the_same_version() {
        let plugins = temp_dir("update-same").join("plugins");
        install_files(&plugins, &plugin("antigo"), &[("index.js".into(), b"antigo".to_vec())]).unwrap();

        let err = update_files(&plugins, &plugin("novo"), &[("index.js".into(), b"novo".to_vec())]).unwrap_err();

        assert!(err.contains("já está na versão 0.1.0"));
        assert_eq!(fs::read_to_string(plugins.join("exemplo").join("index.js")).unwrap(), "antigo");
        let _ = fs::remove_dir_all(plugins.parent().unwrap());
    }

    #[test]
    fn uninstall_refuses_ids_that_could_escape_the_folder() {
        let plugins = temp_dir("escape").join("plugins");
        assert!(uninstall(&plugins, "../x").is_err());
        assert!(uninstall(&plugins, "").is_err());
    }

    #[test]
    fn catalog_refuses_the_same_plugin_id_twice() {
        let json = serde_json::to_string(&Catalog {
            name: "t".into(),
            plugins: vec![plugin("x"), plugin("x")],
        })
        .unwrap();
        let err = parse_catalog(&json).unwrap_err();
        assert!(err.contains("mais de uma vez"), "{err}");
    }

    #[test]
    fn catalog_rejects_path_traversal_and_bad_hashes() {
        let mut traversal = plugin("x");
        traversal.files[0].path = "../fora.js".into();
        traversal.entry = "../fora.js".into();
        let json = serde_json::to_string(&Catalog { name: "t".into(), plugins: vec![traversal] }).unwrap();
        assert!(parse_catalog(&json).is_err());

        let mut bad_hash = plugin("x");
        bad_hash.files[0].sha256 = "abc".into();
        let json = serde_json::to_string(&Catalog { name: "t".into(), plugins: vec![bad_hash] }).unwrap();
        assert!(parse_catalog(&json).unwrap_err().contains("sha256"));
    }

    #[test]
    fn catalog_file_needs_content_or_url_but_not_both() {
        let mut both = plugin("x");
        both.files[0].url = Some("https://exemplo.com/index.js".into());
        let json = serde_json::to_string(&Catalog { name: "t".into(), plugins: vec![both] }).unwrap();
        assert!(parse_catalog(&json).unwrap_err().contains("só um dos dois"));
    }

    #[test]
    fn catalog_sources_must_be_https() {
        assert!(validate_https("https://exemplo.com/marketplace.json").is_ok());
        assert!(validate_https("http://exemplo.com/marketplace.json").is_err());
        assert!(validate_https("file:///C:/x.json").is_err());
    }

    #[test]
    fn adding_and_removing_sources_keeps_the_list_clean() {
        let dir = temp_dir("sources");
        add_source(&dir, "https://a.exemplo.com/m.json").unwrap();
        let after = add_source(&dir, "https://a.exemplo.com/m.json").unwrap();
        assert_eq!(after.urls, vec!["https://a.exemplo.com/m.json"]);

        assert!(add_source(&dir, "http://inseguro.com/m.json").is_err());
        assert!(remove_source(&dir, "https://a.exemplo.com/m.json").unwrap().urls.is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn disabling_a_plugin_is_remembered_and_reversible() {
        let dir = temp_dir("state");
        assert!(set_enabled(&dir, "ask-mode", false).unwrap().disabled.contains(&"ask-mode".to_string()));
        assert!(load_state(&dir).unwrap().disabled.contains(&"ask-mode".to_string()));

        assert!(set_enabled(&dir, "ask-mode", true).unwrap().disabled.is_empty());
        assert!(set_enabled(&dir, "../x", false).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_disabled_plugin_refuses_to_have_its_code_read() {
        let dir = temp_dir("ensure-enabled");
        set_enabled(&dir, "ask-mode", false).unwrap();

        let err = ensure_enabled(&dir, "ask-mode").unwrap_err();
        assert!(err.contains("desligado"), "{err}");
        assert!(ensure_enabled(&dir, "outro").is_ok());

        set_enabled(&dir, "ask-mode", true).unwrap();
        assert!(ensure_enabled(&dir, "ask-mode").is_ok());
        let _ = fs::remove_dir_all(&dir);
    }
}
