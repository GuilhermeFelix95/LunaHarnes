//! Ícone do site (favicon) para as abas e os favoritos. Quem busca é o Rust: a CSP da janela não deixa
//! o front carregar imagem de outro endereço. Só pede `/favicon.ico` da mesma origem da página.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use base64::Engine;
use tauri::Url;

use crate::logfile;

const FETCH_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_ICON_BYTES: usize = 64 * 1024;
const IMAGE_TYPES: [&str; 6] = ["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/gif", "image/jpeg", "image/webp"];

/// Endereço do ícone pedido pela página: a origem dela mais `/favicon.ico`.
pub fn icon_address(page: &str) -> Result<Url, String> {
    let url = Url::parse(page.trim()).map_err(|_| "endereço inválido".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("só páginas http e https têm ícone".into());
    }
    url.join("/favicon.ico").map_err(|e| e.to_string())
}

/// Ícone como `data:` para o front. Recusa o que não é imagem conhecida (uma página de erro, por exemplo) e o que é grande demais.
pub fn image_data_url(content_type: &str, bytes: &[u8]) -> Option<String> {
    let mime = content_type.split(';').next()?.trim().to_ascii_lowercase();
    if !IMAGE_TYPES.contains(&mime.as_str()) || bytes.is_empty() || bytes.len() > MAX_ICON_BYTES {
        return None;
    }
    Some(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

/// Resultado por endereço de ícone. `None` guarda "o site não tem ícone", para não pedir de novo.
static CACHE: Mutex<Option<HashMap<String, Option<String>>>> = Mutex::new(None);

fn cached(key: &str) -> Option<Option<String>> {
    CACHE.lock().ok()?.as_ref()?.get(key).cloned()
}

fn remember(key: String, value: Option<String>) {
    if let Ok(mut cache) = CACHE.lock() {
        cache.get_or_insert_with(HashMap::new).insert(key, value);
    }
}

async fn fetch(icon: &Url) -> Result<Option<String>, String> {
    let client = reqwest::Client::builder()
        .timeout(FETCH_TIMEOUT)
        .build()
        .map_err(|e| format!("não foi possível preparar a conexão: {e}"))?;
    let response = client
        .get(icon.clone())
        .send()
        .await
        .map_err(|e| format!("falha ao pedir o ícone de {}: {e}", icon.host_str().unwrap_or("o site")))?;
    if !response.status().is_success() {
        return Ok(None);
    }
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_string();
    let bytes = response.bytes().await.map_err(|e| format!("falha ao ler o ícone: {e}"))?;
    Ok(image_data_url(&content_type, &bytes))
}

/// Ícone da página, ou `None` quando o site não tem um. Falha de rede vai para o log e não fica no cache.
#[tauri::command]
pub async fn browser_favicon(page_url: String) -> Result<Option<String>, String> {
    let icon = icon_address(&page_url)?;
    let key = icon.to_string();
    if let Some(hit) = cached(&key) {
        return Ok(hit);
    }
    match fetch(&icon).await {
        Ok(value) => {
            remember(key, value.clone());
            Ok(value)
        }
        Err(e) => {
            logfile::error(&format!("não foi possível buscar o ícone do site: {e}"));
            Ok(None)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_icon_comes_from_the_page_origin_only() {
        assert_eq!(icon_address("https://exemplo.com/loja/produto?x=1").unwrap().as_str(), "https://exemplo.com/favicon.ico");
        assert_eq!(icon_address("http://localhost:8080/a").unwrap().as_str(), "http://localhost:8080/favicon.ico");
        assert!(icon_address("file:///C:/segredo.txt").is_err());
    }

    #[test]
    fn only_small_known_images_become_icons() {
        let png = image_data_url("image/png; charset=binary", b"\x89PNG").unwrap();
        assert!(png.starts_with("data:image/png;base64,"));
        assert!(image_data_url("text/html", b"<html>404</html>").is_none(), "página de erro não é ícone");
        assert!(image_data_url("image/png", b"").is_none());
        assert!(image_data_url("image/png", &vec![0u8; MAX_ICON_BYTES + 1]).is_none());
    }
}
