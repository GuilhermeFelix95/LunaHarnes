import { useEffect, useState, type FormEvent } from "react";
import {
  apiPresets,
  apiProfileHasKey,
  checkAuth,
  deleteApiProfile,
  listApiProfiles,
  PROFILES_CHANGED,
  saveApiProfile,
  setApiProfileKey,
  refreshApiModels,
  testApiProfile,
} from "../../api";
import type { ApiPreset, ApiProfile, ProviderKind } from "../../types";
import { PROVIDER_LABELS } from "../../chat/providers";

interface FormState {
  id?: string;
  name: string;
  preset: string;
  baseUrl: string;
  models: string;
  defaultModel: string;
}

const EMPTY_FORM: FormState = { name: "", preset: "anthropic", baseUrl: "", models: "", defaultModel: "" };

function loginLabel(state: boolean | null | undefined): string {
  if (state === undefined) return "verificando…";
  if (state === null) return "não foi possível verificar";
  return state ? "conectado" : "não conectado";
}

/// Diz à barra lateral e ao chat que a lista de perfis mudou.
function announceChange() {
  window.dispatchEvent(new Event(PROFILES_CHANGED));
}

/// Seção "Contas e APIs": login das CLIs e perfis de API (chave no cofre do Windows).
export function ApiProfilesSection() {
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [presets, setPresets] = useState<ApiPreset[]>([]);
  const [keyed, setKeyed] = useState<Record<string, boolean>>({});
  // true/false = conectado ou não; null = a checagem falhou; ausente = ainda verificando.
  const [login, setLogin] = useState<Partial<Record<ProviderKind, boolean | null>>>({});
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [testing, setTesting] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<string | undefined>(undefined);

  async function reload() {
    try {
      const [list, known] = await Promise.all([listApiProfiles(), apiPresets()]);
      setProfiles(list);
      setPresets(known);
      const flags = await Promise.all(list.map((p) => apiProfileHasKey(p.id)));
      setKeyed(Object.fromEntries(list.map((p, i) => [p.id, flags[i]])));
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void reload();
    void Promise.all([checkAuth("claude"), checkAuth("codex")])
      .then(([claude, codex]) => setLogin({ claude, codex }))
      .catch(() => setLogin({ claude: null, codex: null }));
  }, []);

  function edit(profile: ApiProfile) {
    setForm({
      id: profile.id,
      name: profile.name,
      preset: profile.preset,
      baseUrl: profile.baseUrl,
      models: profile.models.join(", "),
      defaultModel: profile.defaultModel ?? "",
    });
    setApiKey("");
    setStatus(undefined);
    setError(undefined);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setStatus(undefined);
    try {
      const models = form.models
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      // O perfil vai sem a chave; a chave segue para o cofre do Windows numa chamada separada.
      const saved = await saveApiProfile({
        id: form.id,
        name: form.name,
        preset: form.preset,
        baseUrl: form.baseUrl.trim(),
        models,
        defaultModel: form.defaultModel.trim() || null,
      });
      if (apiKey.trim()) await setApiProfileKey(saved.id, apiKey);
      setApiKey("");
      setForm({ ...EMPTY_FORM, preset: form.preset });
      setStatus(apiKey.trim() ? "Perfil salvo e chave guardada no cofre do Windows." : "Perfil salvo.");
      announceChange();
      await reload();
    } catch (err) {
      setError(String(err));
    }
  }

  async function remove(id: string) {
    setError(undefined);
    try {
      await deleteApiProfile(id);
      setConfirming(undefined);
      announceChange();
      await reload();
    } catch (err) {
      setError(String(err));
    }
  }

  async function test(id: string) {
    setTesting(id);
    setTestResult((current) => ({ ...current, [id]: "" }));
    try {
      const answer = await testApiProfile(id);
      setTestResult((current) => ({ ...current, [id]: `Resposta: ${answer || "(vazia)"}` }));
    } catch (err) {
      setTestResult((current) => ({ ...current, [id]: `Falhou: ${String(err)}` }));
    } finally {
      setTesting(undefined);
    }
  }

  const presetLabel = (preset: string) => presets.find((p) => p.preset === preset)?.label ?? preset;
  const selectedPreset = presets.find((p) => p.preset === form.preset);

  /// Escolher o provedor preenche os modelos prontos, como o OpenCode faz. O usuário só cola a chave.
  function choosePreset(preset: string) {
    const info = presets.find((p) => p.preset === preset);
    setForm({
      ...form,
      preset,
      models: info && info.suggestedModels.length > 0 ? info.suggestedModels.join(", ") : form.models,
      defaultModel: info?.defaultModel ?? form.defaultModel,
    });
  }

  /// Atualizar: troca a lista pela que a API devolve. O padrão só muda se estiver vazio.
  async function refreshModels() {
    if (!form.id) return;
    setRefreshing(true);
    setError(undefined);
    try {
      const ids = await refreshApiModels(form.id);
      setForm((current) => ({
        ...current,
        models: ids.join(", "),
        defaultModel: current.defaultModel || ids[0],
      }));
      setStatus(`${ids.length} modelo(s) atualizados da API. Salve para guardar a lista.`);
    } catch (err) {
      setError(String(err));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="settings__section" aria-labelledby="settings-accounts">
      <h2 id="settings-accounts">Contas e APIs</h2>

      <h3 className="settings__sub">Login das CLIs</h3>
      <ul className="accounts">
        {(["claude", "codex"] as ProviderKind[]).map((p) => (
          <li key={p}>
            <span>{PROVIDER_LABELS[p]}</span>
            <span className="accounts__status">
              {loginLabel(login[p])}
            </span>
          </li>
        ))}
      </ul>

      <h3 className="settings__sub">Perfis de API</h3>
      <p className="settings__hint">
        Use uma chave própria (OpenRouter, DeepSeek, Z.ai, OpenCode e outras). A chave fica no cofre de credenciais
        do Windows e não aparece nesta tela. As CLIs continuam fazendo o trabalho.
      </p>

      {profiles.length > 0 && (
        <ul className="profiles">
          {profiles.map((p) => (
            <li key={p.id} className="profile">
              <div className="profile__head">
                <strong>{p.name}</strong>
                <span className="profile__meta">
                  {presetLabel(p.preset)} · {keyed[p.id] ? "com chave" : "sem chave"}
                </span>
              </div>
              <div className="profile__actions">
                <button type="button" onClick={() => edit(p)}>
                  Editar
                </button>
                <button type="button" onClick={() => void test(p.id)} disabled={testing !== undefined || !keyed[p.id]}>
                  {testing === p.id ? "Testando…" : "Testar conexão"}
                </button>
                {confirming === p.id ? (
                  <button type="button" className="profile__danger" onClick={() => void remove(p.id)}>
                    Confirmar exclusão
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirming(p.id)}>
                    Excluir
                  </button>
                )}
              </div>
              {testResult[p.id] && <p className="profile__result">{testResult[p.id]}</p>}
            </li>
          ))}
        </ul>
      )}

      <form className="api-form" onSubmit={(e) => void submit(e)}>
        <h3 className="settings__sub">{form.id ? "Editar perfil" : "Novo perfil"}</h3>
        <label>
          Nome
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={60} />
        </label>
        <div className="provider-grid" role="radiogroup" aria-label="Provedor">
          {presets.map((p) => (
            <button
              key={p.preset}
              type="button"
              role="radio"
              aria-checked={form.preset === p.preset}
              className="provider-card"
              onClick={() => choosePreset(p.preset)}
            >
              <span className="provider-card__name">{p.label}</span>
              <span className="provider-card__meta">via {PROVIDER_LABELS[p.engine]}</span>
              {p.suggestedModels.length > 0 && (
                <span className="provider-card__meta">
                  {p.suggestedModels.length === 1 ? "1 modelo pronto" : `${p.suggestedModels.length} modelos prontos`}
                </span>
              )}
            </button>
          ))}
        </div>
        <label>
          Endereço da API
          <input
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder={selectedPreset?.defaultBaseUrl || "padrão do provedor"}
          />
        </label>
        <label>
          Chave da API
          <input
            type="password"
            aria-label="Chave da API"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={form.id && keyed[form.id] ? "•••• já guardada (deixe em branco para manter)" : "cole a chave"}
          />
        </label>
        <label>
          Modelos (separados por vírgula)
          <input
            value={form.models}
            onChange={(e) => setForm({ ...form, models: e.target.value })}
            placeholder="ex.: deepseek-flash, deepseek-v4-pro"
          />
        </label>
        <button type="button" disabled={!form.id || refreshing} onClick={() => void refreshModels()}>
          {refreshing ? "Atualizando…" : "Atualizar lista de modelos"}
        </button>
        {!form.id && <p className="settings__hint">Salve o perfil com a chave para atualizar a lista da API.</p>}
        <label>
          Modelo padrão
          <input value={form.defaultModel} onChange={(e) => setForm({ ...form, defaultModel: e.target.value })} />
        </label>
        <div className="api-form__actions">
          <button type="submit">{form.id ? "Salvar alterações" : "Criar perfil"}</button>
          {form.id && (
            <button type="button" onClick={() => setForm(EMPTY_FORM)}>
              Cancelar edição
            </button>
          )}
        </div>
        {status && <p role="status" className="settings__hint">{status}</p>}
        {error && <p role="alert" className="message__error">{error}</p>}
      </form>
    </section>
  );
}
