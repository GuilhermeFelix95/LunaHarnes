//! Favoritos do navegador integrado: `<app_data>/browser-bookmarks.json`, uma lista de { id, título, endereço }.
//! Só http e https entram, e cada endereço aparece uma vez.
use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::browser::parse_url;
use crate::commands::app_data_dir;

const FILE_NAME: &str = "browser-bookmarks.json";
/// Teto de favoritos, compartilhado com a importação de favoritos.
pub const MAX_BOOKMARKS: usize = 100;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bookmark {
    pub id: String,
    pub title: String,
    pub url: String,
}

/// Lista salva. Arquivo ausente ou ilegível vira lista vazia, para o navegador abrir mesmo assim.
pub fn load_in(dir: &Path) -> Vec<Bookmark> {
    fs::read_to_string(dir.join(FILE_NAME))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

/// Salva a lista inteira (a importação em lote usa).
pub fn save_in(dir: &Path, list: &[Bookmark]) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("não foi possível criar a pasta de dados: {e}"))?;
    let text = serde_json::to_string_pretty(list).map_err(|e| format!("não foi possível montar os favoritos: {e}"))?;
    let tmp = dir.join(format!("{FILE_NAME}.tmp"));
    fs::write(&tmp, text).map_err(|e| format!("não foi possível gravar {FILE_NAME}: {e}"))?;
    fs::rename(&tmp, dir.join(FILE_NAME)).map_err(|e| format!("não foi possível salvar {FILE_NAME}: {e}"))
}

/// Guarda a página como favorita. Endereço já salvo não duplica; o limite é de 100 favoritos.
pub fn add_in(dir: &Path, url: &str, title: &str) -> Result<Vec<Bookmark>, String> {
    let url = parse_url(url)?.to_string();
    let mut list = load_in(dir);
    if list.iter().any(|b| b.url == url) {
        return Ok(list);
    }
    if list.len() >= MAX_BOOKMARKS {
        return Err(format!("o limite é de {MAX_BOOKMARKS} favoritos; remova um para salvar outro"));
    }
    let title = match title.trim() {
        "" => url.clone(),
        typed => typed.chars().take(120).collect(),
    };
    let id = format!("{:x}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
    list.push(Bookmark { id, title, url });
    save_in(dir, &list)?;
    Ok(list)
}

pub fn remove_in(dir: &Path, id: &str) -> Result<Vec<Bookmark>, String> {
    let mut list = load_in(dir);
    list.retain(|b| b.id != id);
    save_in(dir, &list)?;
    Ok(list)
}

#[tauri::command]
pub fn browser_bookmarks(app: AppHandle) -> Result<Vec<Bookmark>, String> {
    Ok(load_in(&app_data_dir(&app)?))
}

#[tauri::command]
pub fn browser_bookmark_add(app: AppHandle, url: String, title: String) -> Result<Vec<Bookmark>, String> {
    add_in(&app_data_dir(&app)?, &url, &title)
}

#[tauri::command]
pub fn browser_bookmark_remove(app: AppHandle, id: String) -> Result<Vec<Bookmark>, String> {
    remove_in(&app_data_dir(&app)?, &id)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("luna-bookmarks-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn adds_lists_and_removes_a_bookmark() {
        let dir = temp_dir("roundtrip");
        let list = add_in(&dir, "https://vps.exemplo.com", "Minha VPS").unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(load_in(&dir)[0].title, "Minha VPS");

        let id = list[0].id.clone();
        assert!(remove_in(&dir, &id).unwrap().is_empty());
    }

    #[test]
    fn the_same_address_is_saved_once() {
        let dir = temp_dir("dedup");
        add_in(&dir, "https://exemplo.com", "").unwrap();
        let list = add_in(&dir, "https://exemplo.com/", "outro nome").unwrap();

        assert_eq!(list.len(), 1);
    }

    #[test]
    fn rejects_schemes_other_than_http_and_https() {
        let dir = temp_dir("scheme");

        assert!(add_in(&dir, "javascript:alert(1)", "x").is_err());
        assert!(add_in(&dir, "file:///C:/segredo.txt", "x").is_err());
        assert!(load_in(&dir).is_empty());
    }

    #[test]
    fn a_missing_or_broken_file_reads_as_empty() {
        let dir = temp_dir("broken");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(FILE_NAME), "{ não é json").unwrap();

        assert!(load_in(&dir).is_empty());
    }

    #[test]
    fn stops_at_the_limit() {
        let dir = temp_dir("limit");
        let full: Vec<Bookmark> = (0..MAX_BOOKMARKS)
            .map(|i| Bookmark { id: i.to_string(), title: "t".into(), url: format!("https://site{i}.com/") })
            .collect();
        save_in(&dir, &full).unwrap();

        assert!(add_in(&dir, "https://novo.com", "").is_err());
    }
}
