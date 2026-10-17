//! Modelos e níveis de esforço que cada CLI aceita. Vêm da própria CLI, não de uma lista fixa aqui.
use serde::Serialize;
use serde_json::Value;

use crate::providers::{cli_name, ProviderKind};
use crate::session::{hidden_command, resolve_program};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelOption {
    /// Valor enviado ao CLI (`--model` no Claude, `-m` no Codex).
    pub id: String,
    pub label: String,
    pub efforts: Vec<String>,
    pub default_effort: Option<String>,
}

/// Níveis de `--effort` que o `claude --help` lista. A CLI não informa quais valem por modelo.
const CLAUDE_EFFORTS: [&str; 5] = ["low", "medium", "high", "xhigh", "max"];
/// Aliases que o `claude --help` cita para `--model`. Nomes completos o usuário digita.
const CLAUDE_ALIASES: [(&str, &str); 3] = [("fable", "Fable"), ("opus", "Opus"), ("sonnet", "Sonnet")];

/// Lê o catálogo do `codex debug models` e mantém só os modelos que o seletor da CLI mostra.
pub fn parse_codex_catalog(json: &str) -> Result<Vec<ModelOption>, String> {
    let root: Value = serde_json::from_str(json).map_err(|e| format!("catálogo do Codex inválido: {e}"))?;
    let models = root
        .get("models")
        .and_then(Value::as_array)
        .ok_or("catálogo do Codex sem a lista `models`")?;

    Ok(models
        .iter()
        .filter(|m| m["visibility"] == "list")
        .filter_map(|m| {
            let id = m["slug"].as_str()?.to_string();
            let label = m["display_name"].as_str().unwrap_or(&id).to_string();
            let efforts = m["supported_reasoning_levels"]
                .as_array()?
                .iter()
                .filter_map(|level| level["effort"].as_str().map(String::from))
                .collect();
            let default_effort = m["default_reasoning_level"].as_str().map(String::from);
            Some(ModelOption { id, label, efforts, default_effort })
        })
        .collect())
}

fn claude_catalog() -> Vec<ModelOption> {
    CLAUDE_ALIASES
        .iter()
        .map(|(id, label)| ModelOption {
            id: id.to_string(),
            label: label.to_string(),
            efforts: CLAUDE_EFFORTS.iter().map(|e| e.to_string()).collect(),
            default_effort: None,
        })
        .collect()
}

/// Roda `codex debug models`. Tenta a lista atual; se falhar (ex.: sem rede), usa a que vem com o binário.
fn codex_catalog() -> Result<Vec<ModelOption>, String> {
    let program = resolve_program(cli_name(ProviderKind::Codex))
        .ok_or("Codex não encontrado no PATH. Instale o CLI para listar os modelos.")?;

    let attempt = |extra: &[&str]| -> Result<String, String> {
        let output = hidden_command(&program)
            .args(["debug", "models"])
            .args(extra)
            .output()
            .map_err(|e| format!("não foi possível listar os modelos do Codex: {e}"))?;
        if !output.status.success() {
            return Err(format!("`codex debug models` terminou com código {:?}", output.status.code()));
        }
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    };

    let raw = attempt(&[]).or_else(|_| attempt(&["--bundled"]))?;
    parse_codex_catalog(&raw)
}

/// Modelos e níveis do provedor escolhido, na ordem em que a CLI os devolve.
pub fn load(kind: ProviderKind) -> Result<Vec<ModelOption>, String> {
    match kind {
        ProviderKind::Claude => Ok(claude_catalog()),
        ProviderKind::Codex => codex_catalog(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../tests/fixtures/codex_models.json");

    #[test]
    fn codex_catalog_keeps_only_models_shown_in_the_cli_picker() {
        let models = parse_codex_catalog(FIXTURE).unwrap();
        let ids: Vec<&str> = models.iter().map(|m| m.id.as_str()).collect();

        assert_eq!(ids, ["gpt-6-luna", "gpt-5.5"]);
    }

    #[test]
    fn codex_catalog_reads_efforts_and_default_per_model() {
        let models = parse_codex_catalog(FIXTURE).unwrap();
        let gpt55 = models.iter().find(|m| m.id == "gpt-5.5").unwrap();

        assert_eq!(gpt55.label, "GPT-5.5");
        assert_eq!(gpt55.efforts, ["low", "medium", "high", "xhigh"]);
        assert_eq!(gpt55.default_effort.as_deref(), Some("medium"));
    }

    #[test]
    fn codex_catalog_rejects_output_without_models_list() {
        assert!(parse_codex_catalog("{}").is_err());
        assert!(parse_codex_catalog("não é json").is_err());
    }

    #[test]
    fn claude_catalog_lists_only_the_aliases_the_cli_documents() {
        let models = claude_catalog();
        let ids: Vec<&str> = models.iter().map(|m| m.id.as_str()).collect();

        assert_eq!(ids, ["fable", "opus", "sonnet"]);
        assert_eq!(models[0].efforts, ["low", "medium", "high", "xhigh", "max"]);
    }
}
