//! Plugins que entram pelo computador: uma pasta escolhida pelo usuário, ou um modelo novo criado pelo app.
//! Usam as mesmas regras de validação do catálogo (`loader::validate`).

use std::fs;
use std::path::{Path, PathBuf};

use super::loader::{validate, Manifest};

/// Tamanho máximo do arquivo de entrada de um plugin copiado de uma pasta.
const MAX_ENTRY_BYTES: u64 = 512 * 1024;

/// Modelo de plugin: o conteúdo de `index.js` que `create_plugin` escreve.
const TEMPLATE_ENTRY: &str = "// Plugin do LunaHarness. Guia completo em docs/plugins.md.
// activate(api) roda ao ligar o plugin. Use só as permissões do manifest.json.
export function activate(api) {
  api.registerCommand(\"ola\", (args) => `olá, ${args}`);
}
";

/// Lê e valida o manifesto de uma pasta escolhida, sem copiar nada. Usado para mostrar as permissões antes de instalar.
pub fn inspect_folder(source: &Path) -> Result<Manifest, String> {
    let text = fs::read_to_string(source.join("manifest.json"))
        .map_err(|e| format!("não foi possível ler manifest.json da pasta escolhida: {e}"))?;
    let manifest: Manifest =
        serde_json::from_str(&text).map_err(|e| format!("manifest.json inválido: {e}"))?;
    // A pasta de origem pode ter outro nome; o que vale é o id do manifesto.
    validate(&manifest, &manifest.id)?;
    Ok(manifest)
}

/// Copia um plugin de uma pasta escolhida para a pasta de plugins: `manifest.json` e o arquivo de entrada.
/// Valida antes de copiar e recusa se já houver um plugin com o mesmo id. Devolve o manifesto instalado.
pub fn install_from_folder(plugins_dir: &Path, source: &Path) -> Result<Manifest, String> {
    let manifest = inspect_folder(source)?;
    let text = fs::read_to_string(source.join("manifest.json"))
        .map_err(|e| format!("não foi possível ler manifest.json da pasta escolhida: {e}"))?;

    let target = plugins_dir.join(&manifest.id);
    if target.exists() {
        return Err(format!("o plugin `{}` já está instalado", manifest.id));
    }

    let entry_path = source.join(&manifest.entry);
    let size = fs::metadata(&entry_path)
        .map_err(|e| format!("entry `{}` não encontrado na pasta: {e}", manifest.entry))?
        .len();
    if size > MAX_ENTRY_BYTES {
        return Err(format!("entry `{}` tem mais de 512 KB", manifest.entry));
    }
    let entry = fs::read(&entry_path)
        .map_err(|e| format!("não foi possível ler entry `{}`: {e}", manifest.entry))?;

    // Monta fora da pasta de plugins, para o scanner nunca ver uma cópia pela metade.
    let staging = staging_for(plugins_dir, &manifest.id);
    let _ = fs::remove_dir_all(&staging);
    let written = write_copy(&staging, &target, plugins_dir, &text, &manifest.entry, &entry);
    if let Err(e) = written {
        let _ = fs::remove_dir_all(&staging);
        return Err(e);
    }
    Ok(manifest)
}

fn write_copy(
    staging: &Path,
    target: &Path,
    plugins_dir: &Path,
    manifest_text: &str,
    entry_name: &str,
    entry: &[u8],
) -> Result<(), String> {
    fs::create_dir_all(staging).map_err(|e| format!("não foi possível preparar a cópia: {e}"))?;
    fs::write(staging.join("manifest.json"), manifest_text)
        .map_err(|e| format!("não foi possível gravar manifest.json: {e}"))?;
    if let Some(parent) = Path::new(entry_name).parent() {
        fs::create_dir_all(staging.join(parent))
            .map_err(|e| format!("não foi possível criar a pasta de `{entry_name}`: {e}"))?;
    }
    fs::write(staging.join(entry_name), entry).map_err(|e| format!("não foi possível gravar `{entry_name}`: {e}"))?;
    fs::create_dir_all(plugins_dir).map_err(|e| format!("não foi possível criar a pasta de plugins: {e}"))?;
    fs::rename(staging, target).map_err(|e| format!("não foi possível concluir a instalação: {e}"))
}

/// Cria um plugin novo, pronto para editar: `manifest.json` e `index.js` com o modelo. Devolve a pasta criada.
pub fn create_plugin(plugins_dir: &Path, id: &str, name: &str) -> Result<PathBuf, String> {
    let manifest = Manifest {
        id: id.to_string(),
        name: name.trim().to_string(),
        version: "0.1.0".into(),
        entry: "index.js".into(),
        permissions: vec!["commands".into()],
    };
    validate(&manifest, id)?;

    let target = plugins_dir.join(id);
    if target.exists() {
        return Err(format!("já existe um plugin `{id}`"));
    }
    let json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("falha ao gerar o manifest.json: {e}"))?;

    let written = fs::create_dir_all(&target)
        .map_err(|e| format!("não foi possível criar a pasta do plugin: {e}"))
        .and_then(|()| {
            fs::write(target.join("manifest.json"), json)
                .map_err(|e| format!("não foi possível gravar manifest.json: {e}"))
        })
        .and_then(|()| {
            fs::write(target.join("index.js"), TEMPLATE_ENTRY)
                .map_err(|e| format!("não foi possível gravar index.js: {e}"))
        });
    if let Err(e) = written {
        let _ = fs::remove_dir_all(&target);
        return Err(e);
    }
    Ok(target)
}

fn staging_for(plugins_dir: &Path, id: &str) -> PathBuf {
    plugins_dir
        .parent()
        .unwrap_or(plugins_dir)
        .join(format!("plugin-staging-{id}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugins::loader::{read_entry, scan};

    /// Pasta temporária isolada para cada teste.
    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("lunaharness-local-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// Escreve uma pasta de origem com manifesto e entrada, como o usuário escolheria no computador.
    fn source_plugin(root: &Path, manifest: &str, entry: &str) -> PathBuf {
        let source = root.join("pasta-escolhida");
        fs::create_dir_all(&source).unwrap();
        fs::write(source.join("manifest.json"), manifest).unwrap();
        fs::write(source.join("index.js"), entry).unwrap();
        source
    }

    const MANIFEST: &str =
        r#"{"id":"hello","name":"Hello","version":"0.1.0","entry":"index.js","permissions":["commands"]}"#;

    #[test]
    fn installs_a_plugin_copied_from_a_folder_even_when_the_folder_has_another_name() {
        let root = temp_dir("copia");
        let plugins = root.join("plugins");
        let source = source_plugin(&root, MANIFEST, "export function activate() {}");

        let manifest = install_from_folder(&plugins, &source).unwrap();

        assert_eq!(manifest.id, "hello");
        assert!(plugins.join("hello").join("manifest.json").exists());
        assert!(plugins.join("hello").join("index.js").exists());
        assert_eq!(scan(&plugins).plugins.len(), 1);
    }

    #[test]
    fn refuses_an_invalid_manifest_and_leaves_no_folder_behind() {
        let root = temp_dir("invalido");
        let plugins = root.join("plugins");
        let source = source_plugin(&root, r#"{"id":"Hello","name":"x","version":"1","entry":"index.js"}"#, "");

        assert!(install_from_folder(&plugins, &source).is_err());
        assert!(!plugins.exists());
    }

    #[test]
    fn refuses_to_replace_an_installed_plugin() {
        let root = temp_dir("repetido");
        let plugins = root.join("plugins");
        let source = source_plugin(&root, MANIFEST, "export function activate() {}");
        install_from_folder(&plugins, &source).unwrap();

        let err = install_from_folder(&plugins, &source).unwrap_err();
        assert!(err.contains("já está instalado"));
    }

    #[test]
    fn refuses_an_entry_bigger_than_the_limit() {
        let root = temp_dir("grande");
        let plugins = root.join("plugins");
        let big = "x".repeat((MAX_ENTRY_BYTES + 1) as usize);
        let source = source_plugin(&root, MANIFEST, &big);

        let err = install_from_folder(&plugins, &source).unwrap_err();
        assert!(err.contains("512 KB"));
        assert!(!plugins.join("hello").exists());
    }

    #[test]
    fn create_plugin_writes_a_folder_the_scanner_accepts() {
        let root = temp_dir("novo");
        let plugins = root.join("plugins");

        let folder = create_plugin(&plugins, "meu-plugin", "  Meu plugin  ").unwrap();

        assert_eq!(folder, plugins.join("meu-plugin"));
        let scanned = scan(&plugins);
        assert!(scanned.errors.is_empty(), "{:?}", scanned.errors);
        assert_eq!(scanned.plugins[0].name, "Meu plugin");
        assert_eq!(scanned.plugins[0].permissions, vec!["commands".to_string()]);
        assert!(read_entry(&plugins, "meu-plugin").unwrap().contains("registerCommand"));
    }

    #[test]
    fn create_plugin_refuses_bad_ids_empty_names_and_existing_folders() {
        let root = temp_dir("ids");
        let plugins = root.join("plugins");
        assert!(create_plugin(&plugins, "../fora", "x").is_err());
        assert!(create_plugin(&plugins, "Com Espaco", "x").is_err());
        assert!(create_plugin(&plugins, "ok", "   ").is_err());

        create_plugin(&plugins, "ok", "Ok").unwrap();
        assert!(create_plugin(&plugins, "ok", "Ok").is_err());
    }
}
