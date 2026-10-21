//! Histórico do navegador integrado: `<app_data>/browser-visits.json`, uma lista de
//! { url, visitAt } com a mais recente primeiro, teto de 500 itens e uma entrada por endereço.
//! O registro acontece quando uma página termina de carregar (ver `browser.rs`).
use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::browser::parse_url;
use crate::commands::app_data_dir;

const FILE_NAME: &str = "browser-visits.json";

/// Teto de itens do histórico. O mais velho sai quando um novo entra.
pub const MAX_VISITS: usize = 500;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Visit {
    pub url: String,
    /// Hora da visita, em milissegundos desde 1970.
    pub visited_at: u64,
}

pub fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Lista salva, da mais recente para a mais antiga. Arquivo ausente ou ilegível vira lista vazia.
pub fn load_in(dir: &Path) -> Vec<Visit> {
    fs::read_to_string(dir.join(FILE_NAME))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn save_in(dir: &Path, list: &[Visit]) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("não foi possível criar a pasta de dados: {e}"))?;
    let text = serde_json::to_string_pretty(list).map_err(|e| format!("não foi possível montar o histórico: {e}"))?;
    let tmp = dir.join(format!("{FILE_NAME}.tmp"));
    fs::write(&tmp, text).map_err(|e| format!("não foi possível gravar {FILE_NAME}: {e}"))?;
    fs::rename(&tmp, dir.join(FILE_NAME)).map_err(|e| format!("não foi possível salvar {FILE_NAME}: {e}"))
}

/// Registra uma visita. Endereço repetido sobe para a primeira posição com a hora nova,
/// o teto é respeitado e a lista passa é devolvida.
pub fn record_in(dir: &Path, url: &str) -> Result<Vec<Visit>, String> {
    let url = parse_url(url)?.to_string();
    let mut list: Vec<Visit> = load_in(dir);
    list.retain(|visit| visit.url != url);
    list.insert(0, Visit { url, visited_at: now_millis() });
    list.truncate(MAX_VISITS);
    save_in(dir, &list)?;
    Ok(list)
}

#[tauri::command]
pub fn browser_visits(app: AppHandle) -> Result<Vec<Visit>, String> {
    Ok(load_in(&app_data_dir(&app)?))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("luna-visits-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn records_a_visit_and_lists_the_most_recent_first() {
        let dir = temp_dir("order");
        record_in(&dir, "https://antiga.com").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let list = record_in(&dir, "https://nova.com").unwrap();

        assert_eq!(list.len(), 2);
        assert_eq!(list[0].url, "https://nova.com/");
        assert_eq!(load_in(&dir)[1].url, "https://antiga.com/");
    }

    #[test]
    fn a_repeated_address_moves_to_the_head_with_a_new_time() {
        let dir = temp_dir("upsert");
        record_in(&dir, "https://exemplo.com").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let list = record_in(&dir, "https://exemplo.com").unwrap();

        assert_eq!(list.len(), 1);
        assert_eq!(list[0].url, "https://exemplo.com/");
    }

    #[test]
    fn a_missing_or_broken_file_reads_as_empty() {
        let dir = temp_dir("empty");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(FILE_NAME), "{ quebrou").unwrap();

        assert!(load_in(&dir).is_empty());
    }

    #[test]
    fn respects_the_limit_of_500() {
        let dir = temp_dir("limit");
        for i in 0..MAX_VISITS {
            record_in(&dir, &format!("https://site{i}.com")).unwrap();
        }
        let list = record_in(&dir, "https://novo.com").unwrap();

        assert_eq!(list.len(), MAX_VISITS);
        assert_eq!(list[0].url, "https://novo.com/");
        // O mais velho da lista (site0, era a última posição antes do novo) sai pelo teto.
        assert!(!list.iter().any(|v| v.url == "https://site0.com/"));
    }

    #[test]
    fn rejects_schemes_other_than_http_and_https() {
        let dir = temp_dir("scheme");

        assert!(record_in(&dir, "file:///C:/certo.txt").is_err());
        assert!(load_in(&dir).is_empty());
    }
}
