//! Guia de plugins para o agente: gravado na pasta de dados do app a cada abertura.
//! A Luna lê esse arquivo por caminho absoluto; a pasta entra no `--add-dir` do CLI.
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

/// Guia completo (`docs/plugins.md`), embutido no binário: não depende da pasta do repositório.
pub const GUIDE_MD: &str = include_str!("../../../docs/plugins.md");
/// Tipos da API, para o agente escrever o `index.js` sem inventar chamadas.
pub const TYPES_DTS: &str = include_str!("../../../plugins-examples/luna-plugin.d.ts");

static GUIDE_DIR: OnceLock<PathBuf> = OnceLock::new();
static DRAFTS_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Grava o guia e os tipos em `<app_data>/docs`, cria `<app_data>/plugin-drafts` e guarda as duas pastas para a Luna.
pub fn install(app_data: &Path) -> std::io::Result<PathBuf> {
    let (dir, drafts) = write_files(app_data)?;
    // Se já foi definida nesta execução, a primeira vale: a pasta não muda ao longo da sessão.
    let _ = GUIDE_DIR.set(dir.clone());
    let _ = DRAFTS_DIR.set(drafts);
    Ok(dir)
}

/// Só grava os arquivos e cria as pastas, sem guardar nada na execução (os testes usam esta parte).
fn write_files(app_data: &Path) -> std::io::Result<(PathBuf, PathBuf)> {
    let dir = app_data.join("docs");
    std::fs::create_dir_all(&dir)?;
    std::fs::write(dir.join("plugins.md"), GUIDE_MD)?;
    std::fs::write(dir.join("luna-plugin.d.ts"), TYPES_DTS)?;
    let drafts = app_data.join("plugin-drafts");
    std::fs::create_dir_all(&drafts)?;
    Ok((dir, drafts))
}

/// Pasta do guia, se ele já foi gravado nesta execução.
pub fn dir() -> Option<&'static Path> {
    GUIDE_DIR.get().map(|p| p.as_path())
}

/// Pasta onde a Luna cria os rascunhos de plugin antes de a pessoa instalar.
pub fn drafts_dir() -> Option<&'static Path> {
    DRAFTS_DIR.get().map(|p| p.as_path())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn install_writes_the_guide_and_the_types() {
        let root = std::env::temp_dir().join(format!("luna-guide-{}", std::process::id()));
        let (dir, drafts) = write_files(&root).expect("grava o guia");

        assert_eq!(std::fs::read_to_string(dir.join("plugins.md")).unwrap(), GUIDE_MD);
        assert!(dir.join("luna-plugin.d.ts").exists());
        assert!(drafts.is_dir(), "pasta de rascunhos criada ao lado do guia");
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn the_embedded_guide_names_the_entry_contract() {
        // O agente precisa saber a forma exata do módulo e do manifesto.
        assert!(GUIDE_MD.contains("export function activate(api)"));
        assert!(GUIDE_MD.contains("manifest.json"));
    }
}
