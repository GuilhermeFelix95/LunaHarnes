//! Modelos e níveis de esforço que o seletor mostra.
//! Codex: vêm do `codex debug models` da própria CLI.
//! Claude: catálogo do seletor do Claude Desktop (seção principal), com os IDs que a CLI aceita em `--model`.
use serde::Serialize;
use serde_json::Value;

use crate::providers::{cli_name, ProviderKind};
use crate::session::{hidden_command, resolve_program};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EffortOption {
    /// Valor enviado à CLI (`--effort` no Claude, `model_reasoning_effort` no Codex).
    pub id: String,
    /// Nome mostrado ao usuário. "Extra" é o `xhigh` da CLI.
    pub label: String,
    pub recommended: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelOption {
    /// Valor enviado ao CLI (`--model` no Claude, `-m` no Codex).
    pub id: String,
    pub label: String,
    pub description: Option<String>,
    pub efforts: Vec<EffortOption>,
    /// Modelo escolhido quando a conversa não tem escolha: o mais barato do provedor.
    pub default: bool,
}

fn effort(id: &str, label: &str, recommended: bool) -> EffortOption {
    EffortOption {
        id: id.into(),
        label: label.into(),
        recommended,
    }
}

/// Níveis do Claude com os nomes do Desktop. Cada modelo marca o seu recomendado.
const CLAUDE_EFFORTS: [(&str, &str); 5] = [("low", "Low"), ("medium", "Medium"), ("high", "High"), ("xhigh", "Extra"), ("max", "Max")];

fn claude_efforts(recommended: &str) -> Vec<EffortOption> {
    CLAUDE_EFFORTS
        .iter()
        .map(|(id, label)| effort(id, label, *id == recommended))
        .collect()
}

/// Catálogo do seletor do Claude Desktop 2.42304.0 (`resources/app.asar`, seção `main`).
/// Quando sair modelo novo, copiar de novo a partir do catálogo do Desktop.
pub fn claude_catalog() -> Vec<ModelOption> {
    let model = |id: &str, label: &str, description: &str, recommended: &str| ModelOption {
        id: id.into(),
        label: label.into(),
        description: Some(description.into()),
        efforts: claude_efforts(recommended),
        default: false,
    };

    vec![
        model("claude-opus-5-5", "Opus 5.5", "Para trabalho complexo e tarefas do dia a dia", "medium"),
        model("claude-sonnet-5-5", "Sonnet 5.5", "Mais eficiente para tarefas mais simples", "medium"),
        model("claude-haiku-5-5", "Haiku 5.5", "O mais rápido para respostas rápidas", "medium"),
        model("claude-fable-5-1", "Fable 5.1", "Para seus desafios mais difíceis", "high"),
    ]
    .into_iter()
    .map(|m| ModelOption { default: m.id == "claude-haiku-5-5", ..m })
    .collect()
}

/// Nome de exibição de um nível do Codex. Os níveis que a CLI não nomeia ficam com o próprio id.
fn codex_effort_label(id: &str) -> &str {
    match id {
        "low" => "Low",
        "medium" => "Medium",
        "high" => "High",
        "xhigh" => "Extra",
        "max" => "Max",
        "ultra" => "Ultra",
        other => other,
    }
}

/// Lê o catálogo do `codex debug models` e mantém só os modelos que o seletor da CLI mostra.
pub fn parse_codex_catalog(json: &str) -> Result<Vec<ModelOption>, String> {
    let root: Value = serde_json::from_str(json).map_err(|e| format!("catálogo do Codex inválido: {e}"))?;
    let models = root
        .get("models")
        .and_then(Value::as_array)
        .ok_or("catálogo do Codex sem a lista `models`")?;

    let mut listed: Vec<ModelOption> = models
        .iter()
        .filter(|m| m["visibility"] == "list")
        .filter_map(|m| {
            let id = m["slug"].as_str()?.to_string();
            let label = m["display_name"].as_str().unwrap_or(&id).to_string();
            let default = m["default_reasoning_level"].as_str();
            let efforts = m["supported_reasoning_levels"]
                .as_array()?
                .iter()
                .filter_map(|level| level["effort"].as_str())
                .map(|id| effort(id, codex_effort_label(id), Some(id) == default))
                .collect();
            Some(ModelOption { id, label, description: None, efforts, default: false })
        })
        .collect();

    // Padrão: a família mais barata da lista, na ordem em que a CLI mostra os modelos.
    if let Some(cheapest) = listed.iter().position(|m| is_cheapest_family(&m.id)) {
        listed[cheapest].default = true;
    }
    Ok(listed)
}

/// Famílias de modelo pequeno e barato do Codex (ex.: gpt-6-luna).
fn is_cheapest_family(id: &str) -> bool {
    ["luna", "mini", "nano"].iter().any(|family| id.contains(family))
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

/// Roda `opencode models`: um modelo por linha, no formato provedor/modelo.
fn opencode_catalog() -> Result<Vec<ModelOption>, String> {
    let program = resolve_program(cli_name(ProviderKind::OpenCode))
        .ok_or("OpenCode não encontrado no PATH. Instale o CLI para listar os modelos.")?;
    let output = hidden_command(&program)
        .arg("models")
        .output()
        .map_err(|e| format!("não foi possível listar os modelos do OpenCode: {e}"))?;
    if !output.status.success() {
        return Err(format!("`opencode models` terminou com código {:?}", output.status.code()));
    }
    Ok(parse_opencode_catalog(&String::from_utf8_lossy(&output.stdout)))
}

/// Só os modelos do próprio OpenCode (`opencode/...`). Os de outro provedor (ex.: `anthropic/...`) ficam de fora;
/// o resto da saída (avisos, linhas em branco) também é ignorado.
pub fn parse_opencode_catalog(raw: &str) -> Vec<ModelOption> {
    raw.lines()
        .map(str::trim)
        .filter(|id| id.starts_with("opencode/"))
        .map(|id| ModelOption {
            id: id.to_string(),
            label: id.to_string(),
            description: None,
            efforts: Vec::new(),
            default: false,
        })
        .collect()
}

/// Modelos do Cline que rodaram de verdade com a CLI 3.0.73 nesta conta (capturas de 2026-10-20). O Cline não lista
/// os modelos pela CLI, então a lista é fixa. Grátis primeiro. Os ClinePass (`cline-pass/*`) ficam de fora:
/// sem assinatura, a CLI recusa com "No access to ClinePass subscription models", e só entram com a assinatura.
fn cline_catalog() -> Vec<ModelOption> {
    [
        ("minimax/minimax-m3.1-flash", "MiniMax M3.1 Flash · grátis"),
        ("cline-free/nemotron-3.5-super-vl", "Nemotron 3.5 Super VL · grátis"),
        ("cline-free/mimo-v2.6-flash", "MiMo-V2.6 Flash · grátis"),
        ("cline-free/muse-spark-1.3-contributor", "Muse Spark 1.3 · grátis"),
        ("cline-free/solar-mini4", "Solar Mini 4 · grátis"),
        ("anthropic/claude-sonnet-5.5", "Claude Sonnet 5.5 · pago"),
    ]
    .into_iter()
    .map(|(id, label)| ModelOption {
        id: id.to_string(),
        label: label.to_string(),
        description: None,
        efforts: Vec::new(),
        default: false,
    })
    .collect()
}

/// Roda `agy models`: uma linha por modelo, `id<TAB>nome`. Sem modelo padrão marcado: sem `--model`, a CLI escolhe.
fn antigravity_catalog() -> Result<Vec<ModelOption>, String> {
    let program = resolve_program(cli_name(ProviderKind::Antigravity))
        .ok_or("Antigravity não encontrado no PATH. Instale o CLI para listar os modelos.")?;
    let output = hidden_command(&program)
        .arg("models")
        .output()
        .map_err(|e| format!("não foi possível listar os modelos do Antigravity: {e}"))?;
    if !output.status.success() {
        return Err(format!("`agy models` terminou com código {:?}", output.status.code()));
    }
    Ok(crate::providers::antigravity::parse_catalog(&String::from_utf8_lossy(&output.stdout))
        .into_iter()
        .map(|(id, label)| ModelOption { id, label, description: None, efforts: Vec::new(), default: false })
        .collect())
}

/// Modelos do Copilot: só "Automático" (id `auto`, sem `--model`, a CLI escolhe). `--model gpt-5.6-luna` e `gpt-5.4`
/// foram recusados pela CLI ("not available"), e a CLI não lista os nomes válidos. Assim o seletor não fica vazio.
fn copilot_catalog() -> Vec<ModelOption> {
    vec![ModelOption {
        id: "auto".into(),
        label: "Automático".into(),
        description: None,
        efforts: Vec::new(),
        default: true,
    }]
}

/// Modelos do Hermes pelo provedor Copilot desta conta (medidos com resposta: gpt-4.1 e gpt-4o). Os modelos do Nous
/// Portal sem créditos e o padrão do Hermes (gpt-6.1-sol) são recusados, então ficam de fora.
fn hermes_catalog() -> Vec<ModelOption> {
    [("gpt-4.1", "GPT-4.1 · Copilot"), ("gpt-4o", "GPT-4o · Copilot")]
        .into_iter()
        .map(|(id, label)| ModelOption {
            id: id.into(),
            label: label.into(),
            description: None,
            efforts: Vec::new(),
            default: id == crate::providers::hermes::DEFAULT_MODEL,
        })
        .collect()
}

/// Modelos e níveis do provedor escolhido.
pub fn load(kind: ProviderKind) -> Result<Vec<ModelOption>, String> {
    match kind {
        ProviderKind::Claude => Ok(claude_catalog()),
        ProviderKind::Codex => codex_catalog(),
        ProviderKind::OpenCode => opencode_catalog(),
        ProviderKind::Cline => Ok(cline_catalog()),
        ProviderKind::Copilot => Ok(copilot_catalog()),
        ProviderKind::Antigravity => antigravity_catalog(),
        ProviderKind::Hermes => Ok(hermes_catalog()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../tests/fixtures/codex_models.json");

    #[test]
    fn cline_lists_only_the_models_that_ran_with_the_free_ones_first() {
        let models = cline_catalog();
        assert!(models.iter().all(|m| !m.default));
        assert!(models.iter().all(|m| !m.id.starts_with("cline-pass/")));
        assert!(models.iter().take_while(|m| m.label.contains("grátis")).count() == 5);
    }

    #[test]
    fn hermes_lists_the_copilot_models_with_the_default_one_first() {
        let models = hermes_catalog();
        assert_eq!(ids(&models), ["gpt-4.1", "gpt-4o"]);
        assert!(models[0].default && !models[1].default);
    }

    fn ids(models: &[ModelOption]) -> Vec<&str> {
        models.iter().map(|m| m.id.as_str()).collect()
    }

    #[test]
    fn claude_catalog_defaults_to_the_cheapest_model() {
        let models = claude_catalog();
        let defaults: Vec<&str> = models.iter().filter(|m| m.default).map(|m| m.id.as_str()).collect();

        assert_eq!(defaults, ["claude-haiku-5-5"]);
    }

    #[test]
    fn codex_catalog_defaults_to_the_cheapest_family() {
        let models = parse_codex_catalog(FIXTURE).unwrap();
        let defaults: Vec<&str> = models.iter().filter(|m| m.default).map(|m| m.id.as_str()).collect();

        assert_eq!(defaults, ["gpt-6-luna"]);
    }

    #[test]
    fn claude_catalog_lists_the_four_desktop_models_with_haiku() {
        let models = claude_catalog();

        assert_eq!(
            ids(&models),
            ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-1"]
        );
        assert_eq!(models[2].label, "Haiku 5.5");
        assert_eq!(models[0].description.as_deref(), Some("Para trabalho complexo e tarefas do dia a dia"));
    }

    #[test]
    fn claude_efforts_use_desktop_names_and_map_extra_to_xhigh() {
        let models = claude_catalog();
        let opus = &models[0];

        let labels: Vec<&str> = opus.efforts.iter().map(|e| e.label.as_str()).collect();
        assert_eq!(labels, ["Low", "Medium", "High", "Extra", "Max"]);
        assert_eq!(opus.efforts[3].id, "xhigh");
    }

    #[test]
    fn claude_recommended_effort_differs_for_fable() {
        let models = claude_catalog();
        let recommended = |m: &ModelOption| m.efforts.iter().find(|e| e.recommended).map(|e| e.id.clone());

        assert_eq!(recommended(&models[0]).as_deref(), Some("medium"));
        assert_eq!(recommended(&models[3]).as_deref(), Some("high"));
    }

    #[test]
    fn codex_catalog_keeps_only_models_shown_in_the_cli_picker() {
        let models = parse_codex_catalog(FIXTURE).unwrap();

        assert_eq!(ids(&models), ["gpt-6-luna", "gpt-5.5"]);
    }

    #[test]
    fn codex_catalog_marks_default_effort_as_recommended() {
        let models = parse_codex_catalog(FIXTURE).unwrap();
        let gpt55 = models.iter().find(|m| m.id == "gpt-5.5").unwrap();

        let labels: Vec<&str> = gpt55.efforts.iter().map(|e| e.label.as_str()).collect();
        assert_eq!(labels, ["Low", "Medium", "High", "Extra"]);
        let recommended: Vec<&str> = gpt55.efforts.iter().filter(|e| e.recommended).map(|e| e.id.as_str()).collect();
        assert_eq!(recommended, ["medium"]);
    }

    #[test]
    fn codex_catalog_rejects_output_without_models_list() {
        assert!(parse_codex_catalog("{}").is_err());
        assert!(parse_codex_catalog("não é json").is_err());
    }

    #[test]
    fn opencode_catalog_keeps_only_the_opencode_models() {
        let raw = "anthropic/claude-haiku-4-5\n\nAviso: algo\nopencode/big-pickle\n";

        assert_eq!(ids(&parse_opencode_catalog(raw)), ["opencode/big-pickle"]);
    }
}
