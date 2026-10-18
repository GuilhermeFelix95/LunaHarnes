//! Perfis de API: um provedor de modelos usado pelo motor de uma CLI (Claude Code ou Codex) com a própria chave.
//!
//! O app não fala com a API diretamente: só passa variáveis de ambiente para o processo do CLI,
//! que continua cuidando das ferramentas, da edição de arquivos e do terminal.
//! Os metadados ficam em `<app_data>/api-profiles.json`, sem segredo.
//! A chave fica no Gerenciador de Credenciais do Windows (keyring) e nunca volta para a interface.

use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::providers::{is_model_token, is_plain_token, ProviderKind};

const FILE_NAME: &str = "api-profiles.json";
/// Serviço no cofre de credenciais. Cada perfil tem o usuário `profile:<id>`.
pub const KEYRING_SERVICE: &str = "lunaharness";
const MAX_NAME_CHARS: usize = 60;
const MAX_MODELS: usize = 50;
const MAX_KEY_CHARS: usize = 1024;
/// Limite do Z.ai para respostas longas (ver a documentação do Claude Code com GLM).
const ZAI_TIMEOUT_MS: &str = "3000000";

/// Provedores prontos. Cada um diz qual motor (CLI) o usa.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Preset {
    Anthropic,
    OpenRouter,
    DeepSeek,
    Zai,
    Moonshot,
    OpenCodeZen,
    CustomAnthropic,
    OpenAi,
}

/// O que a interface mostra para cada preset. `default_base_url` vazio = endpoint oficial do provedor.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PresetInfo {
    pub preset: Preset,
    pub label: &'static str,
    pub engine: ProviderKind,
    pub default_base_url: &'static str,
    /// Modelos que já vêm prontos, como o OpenCode faz: o usuário só cola a chave.
    pub suggested_models: &'static [&'static str],
    /// Modelo escolhido por padrão entre os sugeridos. Vazio = nenhum.
    pub default_model: &'static str,
}

impl Preset {
    pub fn info(self) -> PresetInfo {
        // Modelos sugeridos: IDs a confirmar na lista oficial de cada provedor antes de publicar.
        let (label, engine, default_base_url, suggested_models, default_model): (_, _, _, &[&str], &str) = match self {
            Preset::Anthropic => (
                "Anthropic (chave)",
                ProviderKind::Claude,
                "",
                &["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"],
                "claude-haiku-5-5",
            ),
            Preset::OpenRouter => (
                "OpenRouter",
                ProviderKind::Claude,
                "https://openrouter.ai/api",
                &["qwen/qwen3-coder:free"],
                "qwen/qwen3-coder:free",
            ),
            Preset::DeepSeek => (
                "DeepSeek",
                ProviderKind::Claude,
                "https://api.deepseek.com/anthropic",
                &["deepseek-flash", "deepseek-v4-pro"],
                "deepseek-flash",
            ),
            Preset::Zai => (
                "Z.ai (GLM)",
                ProviderKind::Claude,
                "https://api.z.ai/api/anthropic",
                &["glm-4.7-flash", "glm-5.3-flash", "glm-5.2", "glm-5.1"],
                "glm-4.7-flash",
            ),
            // Moonshot/Kimi: o endereço e o modelo ainda precisam de confirmação na documentação oficial.
            Preset::Moonshot => ("Moonshot / Kimi", ProviderKind::Claude, "https://api.moonshot.ai/anthropic", &["kimi-k3"], "kimi-k3"),
            // Só os modelos que o Zen expõe em /v1/messages: o Claude Code não fala chat/completions.
            Preset::OpenCodeZen => (
                "OpenCode Zen",
                ProviderKind::Claude,
                "https://opencode.ai/inference/anthropic",
                &["claude-haiku-4-5", "claude-sonnet-4-6", "qwen3.6-plus"],
                "claude-haiku-4-5",
            ),
            Preset::CustomAnthropic => ("Compatível com Anthropic (personalizado)", ProviderKind::Claude, "", &[], ""),
            Preset::OpenAi => ("OpenAI (chave)", ProviderKind::Codex, "", &[], ""),
        };
        PresetInfo {
            preset: self,
            label,
            engine,
            default_base_url,
            suggested_models,
            default_model,
        }
    }
}

/// Todos os presets, na ordem que a interface mostra.
pub fn presets() -> Vec<PresetInfo> {
    [
        Preset::Anthropic,
        Preset::OpenRouter,
        Preset::DeepSeek,
        Preset::Zai,
        Preset::Moonshot,
        Preset::OpenCodeZen,
        Preset::CustomAnthropic,
        Preset::OpenAi,
    ]
    .into_iter()
    .map(Preset::info)
    .collect()
}

/// Tempo máximo para listar modelos. A lista é só um botão de atualizar, então falha rápido.
const MODELS_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

/// Ids de modelo da resposta de `GET /v1/models`. Descarta o que não passa na validação de nome.
pub fn parse_model_ids(body: &serde_json::Value) -> Vec<String> {
    let mut ids: Vec<String> = body
        .get("data")
        .and_then(|data| data.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("id").and_then(|id| id.as_str()))
                .filter(|id| is_model_token(id))
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    ids.sort();
    ids.dedup();
    ids
}

/// Busca a lista de modelos do provedor. A chave vai só nos cabeçalhos; os erros citam o endereço, nunca a chave.
pub async fn fetch_model_ids(profile: &ApiProfile, api_key: &str) -> Result<Vec<String>, String> {
    let base = profile
        .effective_base_url()
        .ok_or_else(|| "este provedor não tem endereço de API para listar modelos".to_string())?;
    let url = format!("{}/v1/models", base.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(MODELS_TIMEOUT)
        .build()
        .map_err(|e| format!("não foi possível preparar a conexão: {e}"))?;
    let response = client
        .get(&url)
        .bearer_auth(api_key)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|e| format!("falha ao listar modelos em {url}: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("{url} respondeu {} ao listar modelos", response.status()));
    }
    let text = response
        .text()
        .await
        .map_err(|e| format!("falha ao ler a resposta de {url}: {e}"))?;
    let body: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("a resposta de {url} não é JSON: {e}"))?;
    let ids = parse_model_ids(&body);
    if ids.is_empty() {
        return Err(format!("{url} não devolveu modelos"));
    }
    Ok(ids)
}

/// Perfil salvo. Não há campo de chave: o tipo não consegue carregar o segredo.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiProfile {
    /// Vazio na criação: `prepare` gera o id.
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub preset: Preset,
    /// Vazio = endereço padrão do preset.
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub models: Vec<String>,
    #[serde(default)]
    pub default_model: Option<String>,
}

impl ApiProfile {
    pub fn engine(&self) -> ProviderKind {
        self.preset.info().engine
    }

    /// Endereço que vale para o perfil: o próprio, ou o padrão do preset.
    pub fn effective_base_url(&self) -> Option<String> {
        let own = self.base_url.trim();
        if !own.is_empty() {
            return Some(own.to_string());
        }
        let default = self.preset.info().default_base_url;
        (!default.is_empty()).then(|| default.to_string())
    }

    /// Confere o que a interface envia. Não aceita nada que vire argumento ou URL insegura.
    pub fn validate(&self) -> Result<(), String> {
        if !is_plain_token(&self.id) {
            return Err(format!("id de perfil inválido: {:?}", self.id));
        }
        let name = self.name.trim();
        if name.is_empty() || name.chars().count() > MAX_NAME_CHARS {
            return Err(format!("o nome do perfil precisa ter de 1 a {MAX_NAME_CHARS} caracteres"));
        }
        if self.preset == Preset::CustomAnthropic && self.base_url.trim().is_empty() {
            return Err("o perfil personalizado precisa de um endereço (URL) da API".into());
        }
        if !self.base_url.trim().is_empty() {
            validate_base_url(&self.base_url)?;
        }
        if self.models.len() > MAX_MODELS {
            return Err(format!("no máximo {MAX_MODELS} modelos por perfil"));
        }
        if let Some(bad) = self.models.iter().find(|m| !is_model_token(m)) {
            return Err(format!("nome de modelo inválido: {bad:?}"));
        }
        if let Some(default) = &self.default_model {
            if !self.models.contains(default) {
                return Err(format!("o modelo padrão {default:?} não está na lista do perfil"));
            }
        }
        Ok(())
    }
}

/// Endereço da API: `https`, ou `http` só para o próprio computador.
pub fn validate_base_url(url: &str) -> Result<(), String> {
    let url = url.trim();
    let local = ["http://localhost", "http://127.0.0.1"]
        .iter()
        .any(|prefix| url.strip_prefix(prefix).is_some_and(|rest| rest.is_empty() || rest.starts_with(['/', ':'])));
    let secure = url.strip_prefix("https://").is_some_and(|rest| rest.len() > 3 && !rest.contains(char::is_whitespace));
    if secure || local {
        Ok(())
    } else {
        Err(format!("endereço inválido: {url:?}. Use https (ou http só para localhost)"))
    }
}

/// Prepara um perfil vindo da interface: limpa espaços, gera o id na criação e valida.
pub fn prepare(mut profile: ApiProfile) -> Result<ApiProfile, String> {
    profile.name = profile.name.trim().to_string();
    profile.base_url = profile.base_url.trim().to_string();
    profile.models = profile.models.iter().map(|m| m.trim().to_string()).filter(|m| !m.is_empty()).collect();
    if profile.id.is_empty() {
        profile.id = new_id();
    }
    profile.validate()?;
    Ok(profile)
}

fn new_id() -> String {
    let millis = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    format!("p{millis}")
}

/// Variáveis de ambiente que o CLI recebe só nesta execução. Não toca em `~/.claude` nem `~/.codex`.
pub fn env_for(profile: &ApiProfile, api_key: &str, config_dir: &Path) -> Vec<(String, String)> {
    let mut env = Vec::new();
    match profile.engine() {
        ProviderKind::Claude => {
            // Pasta própria: o login do claude.ai não passa por cima da chave do perfil.
            env.push(("CLAUDE_CONFIG_DIR".into(), config_dir.display().to_string()));
            if profile.preset == Preset::Anthropic {
                env.push(("ANTHROPIC_API_KEY".into(), api_key.into()));
            } else {
                env.push(("ANTHROPIC_AUTH_TOKEN".into(), api_key.into()));
                env.push(("ANTHROPIC_API_KEY".into(), String::new()));
            }
            if let Some(base) = profile.effective_base_url() {
                env.push(("ANTHROPIC_BASE_URL".into(), base));
            }
            if profile.preset == Preset::Zai {
                env.push(("API_TIMEOUT_MS".into(), ZAI_TIMEOUT_MS.into()));
            }
        }
        ProviderKind::Codex => env.push(("OPENAI_API_KEY".into(), api_key.into())),
    }
    env
}

/// Lê os perfis. Arquivo ausente = nenhum perfil ainda.
pub fn load_all(dir: &Path) -> Result<Vec<ApiProfile>, String> {
    let path = dir.join(FILE_NAME);
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!("{FILE_NAME} está corrompido: {e}")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(e) => Err(format!("não foi possível ler {FILE_NAME}: {e}")),
    }
}

/// Grava os perfis trocando o arquivo por inteiro: primeiro um temporário, depois o nome final.
pub fn save_all(dir: &Path, profiles: &[ApiProfile]) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("não foi possível criar a pasta de dados: {e}"))?;
    let json = serde_json::to_string_pretty(profiles).map_err(|e| format!("falha ao gerar {FILE_NAME}: {e}"))?;
    let tmp = dir.join(format!("{FILE_NAME}.tmp"));
    fs::write(&tmp, json).map_err(|e| format!("não foi possível gravar {FILE_NAME}: {e}"))?;
    fs::rename(&tmp, dir.join(FILE_NAME)).map_err(|e| format!("não foi possível salvar {FILE_NAME}: {e}"))
}

/// Pasta de configuração própria do perfil (usada só pelo motor Claude).
pub fn config_dir(app_data: &Path, profile_id: &str) -> std::path::PathBuf {
    app_data.join("claude-api").join(profile_id)
}

fn entry(profile_id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, &format!("profile:{profile_id}"))
        .map_err(|e| format!("não foi possível acessar o cofre de credenciais do Windows: {e}"))
}

/// Guarda a chave no cofre. A chave não aparece em mensagens de erro.
pub fn save_key(profile_id: &str, key: &str) -> Result<(), String> {
    let key = key.trim();
    if key.is_empty() || key.chars().count() > MAX_KEY_CHARS || key.contains(char::is_whitespace) {
        return Err("a chave da API está vazia ou tem um formato inválido".into());
    }
    entry(profile_id)?
        .set_password(key)
        .map_err(|e| format!("não foi possível guardar a chave do perfil {profile_id}: {e}"))
}

/// A chave do perfil, ou `None` quando ainda não foi salva.
pub fn read_key(profile_id: &str) -> Result<Option<String>, String> {
    match entry(profile_id)?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("não foi possível ler a chave do perfil {profile_id}: {e}")),
    }
}

/// Remove a chave do cofre. Sem chave salva, não é erro.
pub fn delete_key(profile_id: &str) -> Result<(), String> {
    match entry(profile_id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("não foi possível apagar a chave do perfil {profile_id}: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn profile(preset: Preset) -> ApiProfile {
        ApiProfile {
            id: "p1".into(),
            name: "Teste".into(),
            preset,
            base_url: String::new(),
            models: vec![],
            default_model: None,
        }
    }

    fn env_map(env: &[(String, String)]) -> std::collections::HashMap<&str, &str> {
        env.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect()
    }

    #[test]
    fn urls_must_be_https_or_local_http() {
        assert!(validate_base_url("https://openrouter.ai/api").is_ok());
        assert!(validate_base_url("http://localhost:4000").is_ok());
        assert!(validate_base_url("http://127.0.0.1/v1").is_ok());

        assert!(validate_base_url("http://openrouter.ai/api").is_err());
        assert!(validate_base_url("http://localhost.evil.com").is_err());
        assert!(validate_base_url("ftp://x.com").is_err());
        assert!(validate_base_url("https://").is_err());
        assert!(validate_base_url("https://x.com/a b").is_err());
    }

    #[test]
    fn model_names_accept_provider_slugs_but_no_spaces_or_flags() {
        let mut p = profile(Preset::OpenRouter);
        p.models = vec!["deepseek/deepseek-v4".into(), "z-ai/glm-5.2:free".into()];
        assert!(p.validate().is_ok());

        p.models = vec!["--help".into()];
        assert!(p.validate().is_err());
        p.models = vec!["gpt 5".into()];
        assert!(p.validate().is_err());
    }

    #[test]
    fn default_model_must_be_in_the_list() {
        let mut p = profile(Preset::DeepSeek);
        p.models = vec!["deepseek-chat".into()];
        p.default_model = Some("outro".into());
        assert!(p.validate().is_err());

        p.default_model = Some("deepseek-chat".into());
        assert!(p.validate().is_ok());
    }

    #[test]
    fn custom_preset_needs_an_address() {
        assert!(profile(Preset::CustomAnthropic).validate().is_err());

        let mut p = profile(Preset::CustomAnthropic);
        p.base_url = "https://minha.api.dev/anthropic".into();
        assert!(p.validate().is_ok());
    }

    #[test]
    fn prepare_creates_an_id_and_trims_fields() {
        let mut raw = profile(Preset::Anthropic);
        raw.id = String::new();
        raw.name = "  Minha conta  ".into();
        raw.models = vec![" claude-haiku-5-5 ".into(), "  ".into()];

        let ready = prepare(raw).unwrap();
        assert!(ready.id.starts_with('p'));
        assert_eq!(ready.name, "Minha conta");
        assert_eq!(ready.models, vec!["claude-haiku-5-5"]);
    }

    #[test]
    fn openrouter_env_moves_the_key_to_auth_token_and_clears_api_key() {
        let env = env_for(&profile(Preset::OpenRouter), "sk-or-123", Path::new("C:\\app\\claude-api\\p1"));
        let map = env_map(&env);

        assert_eq!(map["ANTHROPIC_AUTH_TOKEN"], "sk-or-123");
        assert_eq!(map["ANTHROPIC_API_KEY"], "");
        assert_eq!(map["ANTHROPIC_BASE_URL"], "https://openrouter.ai/api");
        assert_eq!(map["CLAUDE_CONFIG_DIR"], "C:\\app\\claude-api\\p1");
        assert!(!map.contains_key("API_TIMEOUT_MS"));
    }

    #[test]
    fn anthropic_env_uses_api_key_and_no_base_url() {
        let env = env_for(&profile(Preset::Anthropic), "sk-ant-1", Path::new("X"));
        let map = env_map(&env);

        assert_eq!(map["ANTHROPIC_API_KEY"], "sk-ant-1");
        assert!(!map.contains_key("ANTHROPIC_AUTH_TOKEN"));
        assert!(!map.contains_key("ANTHROPIC_BASE_URL"));
    }

    #[test]
    fn zai_gets_longer_timeout() {
        let env = env_for(&profile(Preset::Zai), "k", Path::new("X"));
        assert_eq!(env_map(&env)["API_TIMEOUT_MS"], "3000000");
    }

    #[test]
    fn openai_preset_uses_codex_and_openai_key() {
        let p = profile(Preset::OpenAi);
        assert_eq!(p.engine(), ProviderKind::Codex);
        assert_eq!(env_map(&env_for(&p, "sk-1", Path::new("X")))["OPENAI_API_KEY"], "sk-1");
    }

    #[test]
    fn saved_profile_has_no_secret_field() {
        let json = serde_json::to_string(&profile(Preset::OpenRouter)).unwrap();

        assert!(!json.to_lowercase().contains("key"));
        assert!(!json.to_lowercase().contains("token"));
        assert!(json.contains("\"preset\":\"openRouter\""));
    }

    #[test]
    fn keys_with_spaces_or_newlines_are_refused_before_the_vault() {
        assert!(save_key("p1", "").is_err());
        assert!(save_key("p1", "sk abc").is_err());
        assert!(save_key("p1", "sk-1\nsk-2").is_err());
    }

    #[test]
    fn missing_file_means_no_profiles_and_round_trip_keeps_them() {
        let dir = std::env::temp_dir().join(format!("luna-api-profiles-{}", new_id()));
        assert!(load_all(&dir).unwrap().is_empty());

        let p = prepare(profile(Preset::DeepSeek)).unwrap();
        save_all(&dir, std::slice::from_ref(&p)).unwrap();
        assert_eq!(load_all(&dir).unwrap(), vec![p]);

        let _ = fs::remove_dir_all(&dir);
    }

    /// Usa o cofre de credenciais real deste computador. Não roda por padrão:
    /// `cargo test -- --ignored keyring`. Grava e apaga uma entrada de teste.
    #[test]
    #[ignore]
    fn keyring_round_trip_on_this_machine() {
        let id = "teste-cofre-lunaharness";
        save_key(id, "sk-teste-123").unwrap();
        assert_eq!(read_key(id).unwrap().as_deref(), Some("sk-teste-123"));
        delete_key(id).unwrap();
        assert_eq!(read_key(id).unwrap(), None);
    }

    #[test]
    fn presets_list_has_one_entry_per_preset_with_engine() {
        let list = presets();
        assert_eq!(list.len(), 8);
        assert_eq!(list.iter().find(|p| p.preset == Preset::OpenAi).unwrap().engine, ProviderKind::Codex);
    }

    #[test]
    fn model_list_keeps_valid_ids_sorted_and_unique() {
        let body = serde_json::json!({
            "data": [
                {"id": "qwen/qwen3-coder:free"},
                {"id": "deepseek-flash"},
                {"id": "deepseek-flash"},
                {"id": "--help"},
                {"id": "com espaço"},
                {"nome": "sem id"}
            ]
        });

        assert_eq!(parse_model_ids(&body), vec!["deepseek-flash", "qwen/qwen3-coder:free"]);
        assert!(parse_model_ids(&serde_json::json!({"erro": "x"})).is_empty());
    }

    #[test]
    fn default_model_is_one_of_the_suggested_models() {
        for info in presets() {
            assert!(
                info.default_model.is_empty() || info.suggested_models.contains(&info.default_model),
                "{:?}: padrão fora da lista sugerida",
                info.preset
            );
            assert!(info.suggested_models.iter().all(|m| is_model_token(m)));
        }
    }
}
