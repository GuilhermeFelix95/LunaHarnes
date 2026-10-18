//! Marketplace comum: download com limite e tempo, conferência de sha256 e lista de catálogos por URL.
//! Usado pelos plugins, pelas skills e pelos servidores MCP. Cada um guarda a sua lista de catálogos
//! num arquivo próprio dentro da pasta de dados do app.

use std::fs;
use std::path::Path;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Limite para o catálogo e para cada arquivo baixado.
pub const MAX_BYTES: usize = 1024 * 1024;
const FETCH_TIMEOUT: Duration = Duration::from_secs(20);

/// Lista de catálogos por URL que o usuário adicionou (o oficial não entra aqui).
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CatalogSources {
    #[serde(default)]
    pub urls: Vec<String>,
}

/// Só HTTPS: catálogos e arquivos baixados não trafegam em texto aberto.
pub fn validate_https(url: &str) -> Result<(), String> {
    let url = url.trim();
    let ok = url.strip_prefix("https://").is_some_and(|rest| rest.len() > 3 && !rest.contains(char::is_whitespace));
    if ok {
        Ok(())
    } else {
        Err(format!("endereço inválido: {url:?}. Use https://"))
    }
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
}

/// Recusa arquivo cujo hash não bate com o declarado no catálogo.
pub fn verify(path: &str, bytes: &[u8], expected: &str) -> Result<(), String> {
    if sha256_hex(bytes) == expected.to_ascii_lowercase() {
        Ok(())
    } else {
        Err(format!("o arquivo `{path}` não bate com o sha256 do catálogo; a instalação foi cancelada"))
    }
}

/// Baixa um arquivo ou catálogo, com tempo limite e tamanho máximo.
pub async fn fetch_bytes(url: &str) -> Result<Vec<u8>, String> {
    validate_https(url)?;
    let client = reqwest::Client::builder()
        .timeout(FETCH_TIMEOUT)
        .build()
        .map_err(|e| format!("não foi possível preparar a conexão: {e}"))?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("falha ao baixar {url}: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("{url} respondeu {}", response.status()));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("falha ao ler a resposta de {url}: {e}"))?;
    if bytes.len() > MAX_BYTES {
        return Err(format!("{url} passa de 1 MB"));
    }
    Ok(bytes.to_vec())
}

fn read_sources(path: &Path) -> Result<CatalogSources, String> {
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!("{} está corrompido: {e}", path.display())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(CatalogSources::default()),
        Err(e) => Err(format!("não foi possível ler {}: {e}", path.display())),
    }
}

fn write_sources(path: &Path, sources: &CatalogSources) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("não foi possível criar a pasta de dados: {e}"))?;
    }
    let text = serde_json::to_string_pretty(sources).map_err(|e| format!("falha ao gerar {}: {e}", path.display()))?;
    fs::write(path, text).map_err(|e| format!("não foi possível gravar {}: {e}", path.display()))
}

/// Catálogos por URL guardados em `<app_dir>/<file_name>`.
pub fn load_sources_in(app_dir: &Path, file_name: &str) -> Result<CatalogSources, String> {
    read_sources(&app_dir.join(file_name))
}

/// Adiciona uma URL à lista. Confira o catálogo (download e leitura) antes de chamar isto.
pub fn add_source_in(app_dir: &Path, file_name: &str, url: &str) -> Result<CatalogSources, String> {
    validate_https(url)?;
    let path = app_dir.join(file_name);
    let mut sources = read_sources(&path)?;
    let url = url.trim().to_string();
    if !sources.urls.contains(&url) {
        sources.urls.push(url);
    }
    write_sources(&path, &sources)?;
    Ok(sources)
}

pub fn remove_source_in(app_dir: &Path, file_name: &str, url: &str) -> Result<CatalogSources, String> {
    let path = app_dir.join(file_name);
    let mut sources = read_sources(&path)?;
    sources.urls.retain(|u| u != url);
    write_sources(&path, &sources)?;
    Ok(sources)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("luna-common-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn guarda_so_https_e_nao_repete_a_url() {
        let dir = temp_dir("sources");
        assert!(add_source_in(&dir, "skills-catalogs.json", "http://exemplo.com/c.json").is_err());
        add_source_in(&dir, "skills-catalogs.json", "https://exemplo.com/c.json").unwrap();
        let again = add_source_in(&dir, "skills-catalogs.json", "https://exemplo.com/c.json").unwrap();
        assert_eq!(again.urls.len(), 1);
        let removed = remove_source_in(&dir, "skills-catalogs.json", "https://exemplo.com/c.json").unwrap();
        assert!(removed.urls.is_empty());
    }

    #[test]
    fn sha256_confere_e_recusa_hash_errado() {
        assert!(verify("a.md", b"oi", &sha256_hex(b"oi")).is_ok());
        assert!(verify("a.md", b"oi", &"0".repeat(64)).is_err());
    }
}
