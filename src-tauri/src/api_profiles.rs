//! Perfis de API: um provedor de modelos usado pelo motor de uma CLI (Claude Code ou Codex) com a própria chave.
//!
//! O app não fala com a API diretamente: só passa variáveis de ambiente para o processo do CLI,
//! que continua cuidando das ferramentas, da edição de arquivos e do terminal.
//! Os metadados ficam em `<app_data>/api-profiles.json`, sem segredo.
//! A chave fica no Gerenciador de Credenciais do Windows (keyring) e nunca volta para a interface.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::providers::{is_model_token, is_plain_token, ProviderKind};

const FILE_NAME: &str = "api-profiles.json";
/// Serviço no cofre de credenciais. Cada perfil tem o usuário `profile:<id>`.
pub const KEYRING_SERVICE: &str = "lunaharness";
const MAX_NAME_CHARS: usize = 60;
/// Lista de modelos por perfil. O OpenRouter devolve ~470; o limite cobre isso com folga.
const MAX_MODELS: usize = 1000;
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
    OpenCodeGo,
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
    /// Modelos listados pelo provedor que o Claude Code não usa (outro formato de API). Só aparecem marcados.
    pub unsupported_models: &'static [&'static str],
}

/// OpenCode Go, lista pública de /v1/models. Só o MiniMax M3 tem indício de /v1/messages (formato Anthropic);
/// os demais são marcados como não compatíveis até um teste com chave confirmar.
const OPENCODE_GO_UNSUPPORTED: &[&str] = &[
    "deepseek-v4.1-flash",
    "deepseek-v4-pro",
    "glm-5.1",
    "glm-5.2",
    "glm-5.3",
    "grok-4.6",
    "grok-4.7",
    "muse-spark-1.2-contributor",
    "muse-spark-1.3-contributor",
    "glm-5.3-flash",
    "omen-alpha",
    "gpt-5.6-luna",
    "gpt-6-luna",
    "claude-haiku-5-5",
    "hy3",
    "hy4-preview",
    "kimi-k2.6",
    "kimi-k2.7-code",
    "kimi-k3",
    "mimo-v2.5",
    "mimo-v2.6-flash",
    "mimo-v2.5-pro",
    "mimo-v2.6-pro",
    "minimax-m2.5",
    "minimax-m2.7",
    "gemini-4-argon-contributor",
    "space-bunny",
    "longcat-2.0",
    "longcat-2.5-preview-free",
    "step-5-preview",
    "beam-free",
    "qwen3.6-plus",
    "qwen3.7-max",
    "qwen3.8-max",
    "qwen3.8-flash",
    "qwen3.7-plus",
];

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
                &["glm-5.3-flash", "glm-5.3", "glm-5.2"],
                "glm-5.3-flash",
            ),
            // Moonshot/Kimi: endereço e modelos conferidos na documentação oficial (kimi-k3 é o recomendado).
            Preset::Moonshot => (
                "Moonshot / Kimi",
                ProviderKind::Claude,
                "https://api.moonshot.ai/anthropic",
                &["kimi-k3", "kimi-k2.7-code", "kimi-k2.6"],
                "kimi-k3",
            ),
            Preset::OpenCodeGo => (
                "OpenCode Go",
                ProviderKind::Claude,
                "https://opencode.ai/zen/go",
                &["minimax-m3"],
                "minimax-m3",
            ),
            Preset::CustomAnthropic => ("Compatível com Anthropic (personalizado)", ProviderKind::Claude, "", &[], ""),
            Preset::OpenAi => ("OpenAI (chave)", ProviderKind::Codex, "", &[], ""),
        };
        let unsupported_models: &'static [&'static str] = match self {
            Preset::OpenCodeGo => OPENCODE_GO_UNSUPPORTED,
            _ => &[],
        };
        PresetInfo {
            preset: self,
            label,
            engine,
            default_base_url,
            suggested_models,
            default_model,
            unsupported_models,
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
        Preset::OpenCodeGo,
        Preset::CustomAnthropic,
        Preset::OpenAi,
    ]
    .into_iter()
    .map(Preset::info)
    .collect()
}

/// Tempo máximo para listar modelos. A lista é só um botão de atualizar, então falha rápido.
const MODELS_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

/// Modelos que a API devolve. `cheapest` é o de menor preço de entrada; `None` quando a API não informa preço.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteModels {
    pub ids: Vec<String>,
    pub cheapest: Option<String>,
    /// Janela de contexto em tokens, por id, quando a API informa.
    pub contexts: BTreeMap<String, u64>,
}

/// Quais modelos da lista aparecem no chat. `Free` mostra só os `:free` (OpenRouter).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ModelScope {
    #[default]
    All,
    Free,
}

/// Modelos de `GET /v1/models` (formato da Anthropic e do OpenRouter). Descarta ids que não passam na validação de nome.
pub fn parse_models(body: &serde_json::Value) -> RemoteModels {
    let mut priced: Vec<(String, f64)> = body
        .get("data")
        .and_then(|data| data.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let id = item.get("id").and_then(|id| id.as_str()).filter(|id| is_model_token(id))?;
                    Some((id.to_string(), prompt_price(item)))
                })
                .collect()
        })
        .unwrap_or_default();
    priced.sort_by(|a, b| a.0.cmp(&b.0));
    priced.dedup_by(|a, b| a.0 == b.0);
    let cheapest = priced
        .iter()
        .filter(|(_, price)| price.is_finite())
        .min_by(|a, b| a.1.total_cmp(&b.1))
        .map(|(id, _)| id.clone());
    // Janela de contexto de cada modelo, quando a API informa (`context_length` no OpenRouter).
    let mut contexts = BTreeMap::new();
    for item in body.get("data").and_then(|data| data.as_array()).into_iter().flatten() {
        let id = item.get("id").and_then(|id| id.as_str()).filter(|id| is_model_token(id));
        let size = item.get("context_length").and_then(|size| size.as_u64());
        if let (Some(id), Some(size)) = (id, size) {
            contexts.insert(id.to_string(), size);
        }
    }
    RemoteModels {
        ids: priced.into_iter().map(|(id, _)| id).collect(),
        cheapest,
        contexts,
    }
}

/// Preço de entrada por token. O OpenRouter manda texto ("0"); sem preço vira infinito.
fn prompt_price(item: &serde_json::Value) -> f64 {
    let parsed = match item.get("pricing").and_then(|p| p.get("prompt")) {
        Some(serde_json::Value::String(text)) => text.parse::<f64>().ok(),
        Some(serde_json::Value::Number(number)) => number.as_f64(),
        _ => None,
    };
    parsed.unwrap_or(f64::INFINITY)
}

/// Endereço para listar modelos: o que o usuário digitou (validado) ou o padrão do preset.
pub fn base_url_for(preset: Preset, base_url: &str) -> Result<String, String> {
    let own = base_url.trim();
    if !own.is_empty() {
        validate_base_url(own)?;
        return Ok(own.to_string());
    }
    let default = preset.info().default_base_url;
    if default.is_empty() {
        return Err("informe o endereço da API deste provedor".into());
    }
    Ok(default.to_string())
}

/// O OpenRouter muda a resposta de `/v1/models` quando recebe `anthropic-version`: devolve só 20 ids no formato Anthropic.
/// Por isso ele recebe só o Bearer; os demais provedores seguem como antes.
fn uses_anthropic_headers(preset: Preset) -> bool {
    preset != Preset::OpenRouter
}

/// Busca a lista de modelos num endereço de API. A chave vai só nos cabeçalhos; os erros citam o endereço, nunca a chave.
pub async fn fetch_models(preset: Preset, base: &str, api_key: &str) -> Result<RemoteModels, String> {
    let url = format!("{}/v1/models", base.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(MODELS_TIMEOUT)
        .build()
        .map_err(|e| format!("não foi possível preparar a conexão: {e}"))?;
    let mut request = client.get(&url).bearer_auth(api_key);
    if uses_anthropic_headers(preset) {
        request = request.header("x-api-key", api_key).header("anthropic-version", "2023-06-01");
    }
    let response = request
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
    let models = parse_models(&body);
    if models.ids.is_empty() {
        return Err(format!("{url} não devolveu modelos"));
    }
    Ok(models)
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
    /// Só o OpenRouter usa: `Free` esconde os modelos pagos no chat. A lista guardada continua completa.
    #[serde(default)]
    pub model_scope: ModelScope,
    /// Janela de contexto por modelo, em tokens, quando a API informou.
    #[serde(default)]
    pub context_windows: BTreeMap<String, u64>,
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
/// Cache de prompt de 1 h do Claude Code. Só vale para chave da própria Anthropic: nos outros endpoints o TTL é o que o provedor define.
pub fn long_cache_env(profile: &ApiProfile) -> Vec<(String, String)> {
    if profile.engine() == ProviderKind::Claude && profile.preset == Preset::Anthropic {
        vec![("ENABLE_PROMPT_CACHING_1H".into(), "1".into())]
    } else {
        Vec::new()
    }
}

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
            if profile.preset == Preset::OpenRouter {
                // Saída pequena: o OpenRouter só libera a resposta se a conta cobrir o limite pedido.
                env.push(("CLAUDE_CODE_MAX_OUTPUT_TOKENS".into(), "4096".into()));
            }
            if profile.preset != Preset::Anthropic {
                // Sem betas da Anthropic: endpoints de terceiros recusam os recursos extras com 400.
                env.push(("CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS".into(), "1".into()));
            }
        }
        ProviderKind::Codex => env.push(("OPENAI_API_KEY".into(), api_key.into())),
        // Nenhum perfil de API usa o motor OpenCode nem o Cline ainda.
        ProviderKind::OpenCode | ProviderKind::Cline => {}
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
            model_scope: ModelScope::All,
            context_windows: BTreeMap::new(),
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
        // O Claude Code pede até 32000 tokens de saída; o OpenRouter reserva crédito por esse valor e recusa com 402.
        assert_eq!(map["CLAUDE_CODE_MAX_OUTPUT_TOKENS"], "4096");
        // Sem betas da Anthropic: o OpenRouter repassa o pedido e modelos não Anthropic recusam (400 de ferramentas adiadas).
        assert_eq!(map["CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS"], "1");
    }

    #[test]
    fn anthropic_profile_keeps_the_experimental_betas() {
        let env = env_for(&profile(Preset::Anthropic), "sk-ant-1", Path::new("X"));

        assert!(!env_map(&env).contains_key("CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS"));
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
    fn parse_models_keeps_the_context_window_of_each_model() {
        let body = serde_json::json!({
            "data": [
                {"id": "nvidia/x:free", "context_length": 131072, "pricing": {"prompt": "0"}},
                {"id": "sem/contexto"}
            ]
        });

        let models = parse_models(&body);

        assert_eq!(models.contexts.get("nvidia/x:free"), Some(&131072));
        assert!(!models.contexts.contains_key("sem/contexto"));
    }

    #[test]
    fn openrouter_models_request_sends_no_anthropic_headers() {
        // Com `anthropic-version`, o OpenRouter responde só 20 ids no formato Anthropic: a lista some.
        assert!(!uses_anthropic_headers(Preset::OpenRouter));
        assert!(uses_anthropic_headers(Preset::DeepSeek));
    }

    #[test]
    fn openrouter_list_keeps_every_model_beyond_the_first_page() {
        let data: Vec<serde_json::Value> = (0..471)
            .map(|i| serde_json::json!({"id": format!("vendor/model-{i}"), "pricing": {"prompt": "0.000001"}}))
            .collect();

        let models = parse_models(&serde_json::json!({ "data": data }));

        assert_eq!(models.ids.len(), 471);
    }

    #[test]
    fn a_full_openrouter_list_is_accepted() {
        let mut profile = profile(Preset::OpenRouter);
        profile.models = (0..471).map(|i| format!("vendor/model-{i}")).collect();

        assert!(profile.validate().is_ok());
    }

    #[test]
    fn opencode_go_uses_its_own_address_and_minimax() {
        let info = Preset::OpenCodeGo.info();

        assert_eq!(info.default_base_url, "https://opencode.ai/zen/go");
        assert_eq!(info.default_model, "minimax-m3");
        assert_eq!(info.engine, ProviderKind::Claude);
    }

    #[test]
    fn moonshot_and_zai_use_the_documented_endpoints_and_defaults() {
        let moonshot = Preset::Moonshot.info();
        assert_eq!(moonshot.default_base_url, "https://api.moonshot.ai/anthropic");
        assert_eq!(moonshot.default_model, "kimi-k3");

        let zai = Preset::Zai.info();
        assert_eq!(zai.default_base_url, "https://api.z.ai/api/anthropic");
        assert_eq!(zai.default_model, "glm-5.3-flash");
    }

    #[test]
    fn opencode_go_marks_every_listed_model_except_minimax() {
        let info = Preset::OpenCodeGo.info();

        assert_eq!(info.unsupported_models.len(), 36);
        assert!(!info.unsupported_models.contains(&"minimax-m3"));
        assert!(info.unsupported_models.contains(&"kimi-k3"));
        assert!(info.suggested_models.iter().all(|m| !info.unsupported_models.contains(m)));
    }

    #[test]
    fn model_scope_defaults_to_all_models() {
        let saved = r#"{"id":"p1","name":"OpenRouter","preset":"openRouter"}"#;
        let parsed: ApiProfile = serde_json::from_str(saved).unwrap();

        assert_eq!(parsed.model_scope, ModelScope::All);
        assert!(parsed.context_windows.is_empty());
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

        assert_eq!(parse_models(&body).ids, vec!["deepseek-flash", "qwen/qwen3-coder:free"]);
        assert!(parse_models(&serde_json::json!({"erro": "x"})).ids.is_empty());
    }

    #[test]
    fn cheapest_model_comes_from_pricing_and_skips_unpriced() {
        let body = serde_json::json!({
            "data": [
                {"id": "paga/grande", "pricing": {"prompt": "0.000003"}},
                {"id": "gratis/x:free", "pricing": {"prompt": "0"}},
                {"id": "sem/preco"}
            ]
        });

        assert_eq!(parse_models(&body).cheapest.as_deref(), Some("gratis/x:free"));
        assert_eq!(parse_models(&serde_json::json!({"data": [{"id": "sem/preco"}]})).cheapest, None);
    }

    #[test]
    fn base_url_comes_from_the_preset_or_the_typed_address() {
        assert_eq!(base_url_for(Preset::OpenRouter, "").unwrap(), "https://openrouter.ai/api");
        assert_eq!(base_url_for(Preset::OpenRouter, "https://meu.proxy/api").unwrap(), "https://meu.proxy/api");
        // Nome de modelo digitado no campo de endereço é recusado, como aconteceu na tela.
        assert!(base_url_for(Preset::OpenRouter, "poolside/laguna-s-2.1:free").is_err());
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

    #[test]
    fn long_cache_is_only_for_anthropic_keys() {
        assert_eq!(long_cache_env(&profile(Preset::Anthropic)), vec![("ENABLE_PROMPT_CACHING_1H".to_string(), "1".to_string())]);
        assert!(long_cache_env(&profile(Preset::OpenRouter)).is_empty());
    }
}
