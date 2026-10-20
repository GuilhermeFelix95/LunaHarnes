//! Orquestrador de modelos: qual motor e modelo cuida de cada papel (plano, execução, conversar e subagentes).
//!
//! Fica em `<app_data>/orchestrator.json`. Este módulo só guarda e valida a escolha; quem aplica o papel
//! a cada envio é o chat. Papel sem escolha vale o que a conversa já usa.
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::commands::app_data_dir;
use crate::providers::{is_model_token, is_plain_token, ProviderKind};

const FILE_NAME: &str = "orchestrator.json";
/// Subagente do Claude que executa as etapas do plano, com o modelo do papel de subagentes.
const AGENTS_FILE: &str = "claude-agents.json";
const SUBAGENT_NAME: &str = "luna-etapa";
static AGENTS: OnceLock<PathBuf> = OnceLock::new();

/// Guarda onde fica o arquivo de subagentes, para o Claude receber o caminho em cada execução.
pub fn start(app_data: &Path) {
    let _ = AGENTS.set(app_data.join(AGENTS_FILE));
}

/// Arquivo de subagentes do Claude, se o app já definiu a pasta de dados.
pub fn agents_path() -> Option<&'static Path> {
    AGENTS.get().map(PathBuf::as_path)
}

/// Texto do arquivo de `--agents`: um subagente só, com o modelo escolhido para o papel.
pub fn agents_json(model: &str) -> String {
    serde_json::json!({
        SUBAGENT_NAME: {
            "description": "Executa uma etapa do plano aprovado",
            "prompt": "Você executa uma etapa delegada pela Luna. Faça só essa etapa, com as ferramentas disponíveis, e responda em uma ou duas frases com o resultado.",
            "model": model
        }
    })
    .to_string()
}

/// Grava o subagente quando o papel está escolhido, e apaga o arquivo quando não está.
pub fn write_agents(dir: &Path, subagent: Option<&RoleModel>) -> Result<(), String> {
    let path = dir.join(AGENTS_FILE);
    match subagent {
        Some(role) => {
            fs::create_dir_all(dir).map_err(|e| format!("não foi possível criar a pasta de dados: {e}"))?;
            let tmp = dir.join(format!("{AGENTS_FILE}.tmp"));
            fs::write(&tmp, agents_json(&role.model)).map_err(|e| format!("não foi possível gravar {AGENTS_FILE}: {e}"))?;
            fs::rename(&tmp, &path).map_err(|e| format!("não foi possível salvar {AGENTS_FILE}: {e}"))
        }
        None => match fs::remove_file(&path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(format!("não foi possível remover {AGENTS_FILE}: {e}")),
        },
    }
}

/// Motor, modelo e esforço escolhidos para um papel.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleModel {
    pub provider: ProviderKind,
    pub model: String,
    #[serde(default)]
    pub effort: Option<String>,
}

/// Os quatro papéis. Ausente = o papel usa a conversa atual.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Orchestrator {
    #[serde(default)]
    pub plan: Option<RoleModel>,
    #[serde(default)]
    pub execute: Option<RoleModel>,
    #[serde(default)]
    pub chat: Option<RoleModel>,
    #[serde(default)]
    pub subagent: Option<RoleModel>,
}

/// Lê a escolha salva. Sem arquivo, nenhum papel escolhido.
pub fn load(dir: &Path) -> Result<Orchestrator, String> {
    match fs::read_to_string(dir.join(FILE_NAME)) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!("{FILE_NAME} não é válido: {e}")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Orchestrator::default()),
        Err(e) => Err(format!("não foi possível ler {FILE_NAME}: {e}")),
    }
}

/// Grava a escolha trocando o arquivo por inteiro: primeiro um temporário, depois o nome final.
pub fn save(dir: &Path, orchestrator: &Orchestrator) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("não foi possível criar a pasta de dados: {e}"))?;
    let text = serde_json::to_string_pretty(orchestrator).map_err(|e| format!("não foi possível montar {FILE_NAME}: {e}"))?;
    let tmp = dir.join(format!("{FILE_NAME}.tmp"));
    fs::write(&tmp, text).map_err(|e| format!("não foi possível gravar {FILE_NAME}: {e}"))?;
    fs::rename(&tmp, dir.join(FILE_NAME)).map_err(|e| format!("não foi possível salvar {FILE_NAME}: {e}"))
}

/// Recusa nome de modelo ou esforço que não sejam tokens simples, antes de virarem argumento de CLI.
pub fn validate(orchestrator: &Orchestrator) -> Result<(), String> {
    for (role, choice) in [
        ("plan", &orchestrator.plan),
        ("execute", &orchestrator.execute),
        ("chat", &orchestrator.chat),
        ("subagent", &orchestrator.subagent),
    ] {
        let Some(choice) = choice else { continue };
        if !is_model_token(&choice.model) {
            return Err(format!("modelo inválido no papel {role}: {:?}", choice.model));
        }
        if let Some(effort) = &choice.effort {
            if !is_plain_token(effort) {
                return Err(format!("esforço inválido no papel {role}: {effort:?}"));
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_orchestrator(app: AppHandle) -> Result<Orchestrator, String> {
    load(&app_data_dir(&app)?)
}

#[tauri::command]
pub fn save_orchestrator(app: AppHandle, orchestrator: Orchestrator) -> Result<(), String> {
    validate(&orchestrator)?;
    let dir = app_data_dir(&app)?;
    save(&dir, &orchestrator)?;
    write_agents(&dir, orchestrator.subagent.as_ref())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("luna-orchestrator-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn choice(provider: ProviderKind, model: &str) -> RoleModel {
        RoleModel { provider, model: model.into(), effort: Some("high".into()) }
    }

    #[test]
    fn without_a_file_no_role_is_chosen() {
        assert_eq!(load(&temp_dir("vazio")).unwrap(), Orchestrator::default());
    }

    #[test]
    fn a_saved_choice_comes_back_as_it_was() {
        let dir = temp_dir("ida-e-volta");
        let saved = Orchestrator { plan: Some(choice(ProviderKind::Claude, "claude-opus-5-5")), execute: Some(choice(ProviderKind::Codex, "gpt-5.5")), ..Default::default() };
        save(&dir, &saved).unwrap();
        assert_eq!(load(&dir).unwrap(), saved);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_model_or_effort_that_is_not_a_plain_token_is_refused() {
        let bad_model = Orchestrator { chat: Some(RoleModel { provider: ProviderKind::Claude, model: "x --dangerous".into(), effort: None }), ..Default::default() };
        assert!(validate(&bad_model).is_err());
        let bad_effort = Orchestrator { plan: Some(RoleModel { provider: ProviderKind::Codex, model: "gpt-5.5".into(), effort: Some("a b".into()) }), ..Default::default() };
        assert!(validate(&bad_effort).is_err());
    }

    #[test]
    fn subagent_file_uses_the_chosen_model_and_goes_away_when_unset() {
        let dir = temp_dir("subagente");
        write_agents(&dir, Some(&choice(ProviderKind::Claude, "claude-haiku-5-5"))).unwrap();
        let json: serde_json::Value = serde_json::from_str(&fs::read_to_string(dir.join(AGENTS_FILE)).unwrap()).unwrap();
        assert_eq!(json[SUBAGENT_NAME]["model"], "claude-haiku-5-5");
        write_agents(&dir, None).unwrap();
        assert!(!dir.join(AGENTS_FILE).exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_broken_file_is_an_error_naming_the_file() {
        let dir = temp_dir("quebrado");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(FILE_NAME), "{ nao e json").unwrap();
        let error = load(&dir).unwrap_err();
        assert!(error.contains(FILE_NAME));
        let _ = fs::remove_dir_all(&dir);
    }
}
