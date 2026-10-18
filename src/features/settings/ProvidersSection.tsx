import { useEffect, useState, type FormEvent } from "react";
import {
  apiPresets,
  apiProfileHasKey,
  deleteApiProfile,
  listApiProfiles,
  PROFILES_CHANGED,
  saveApiProfile,
  setApiProfileKey,
  listProviderModels,
  refreshApiModels,
  testApiProfile,
} from "../../api";
import type { ApiPreset, ApiProfile, RemoteModels } from "../../types";
import { PROVIDER_LABELS } from "../../chat/providers";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { Dialog } from "../../ui/Dialog";
import { t } from "../../i18n";

interface FormState {
  id?: string;
  name: string;
  preset: string;
  baseUrl: string;
  models: string;
  defaultModel: string;
  /** Só OpenRouter: "free" mostra no chat apenas os modelos com :free. */
  modelScope: "all" | "free";
  /** Janela de contexto por modelo, vinda da API. */
  contexts: Record<string, number>;
}

const EMPTY_FORM: FormState = {
  name: "",
  preset: "anthropic",
  baseUrl: "",
  models: "",
  defaultModel: "",
  modelScope: "all",
  contexts: {},
};

/// Diz à barra lateral e ao chat que a lista de perfis mudou.
function announceChange() {
  window.dispatchEvent(new Event(PROFILES_CHANGED));
}

/// Provedores: perfis de API em cartões. Criar e editar abrem numa janela; a chave fica no cofre do Windows.
export function ProvidersSection() {
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [presets, setPresets] = useState<ApiPreset[]>([]);
  const [keyed, setKeyed] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState<ApiProfile | undefined>(undefined);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [testing, setTesting] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  // Lista de onde se escolhem os modelos do perfil (a da API, a do preset ou a salva); a busca filtra esta lista.
  const [catalog, setCatalog] = useState<string[]>([]);
  const [modelQuery, setModelQuery] = useState("");

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
  }, []);

  function openNew() {
    setForm({ ...EMPTY_FORM, preset: presets[0]?.preset ?? EMPTY_FORM.preset });
    setCatalog([]);
    setApiKey("");
    setStatus(undefined);
    setError(undefined);
    setEditing(true);
  }

  function closeForm() {
    setEditing(false);
    setForm(EMPTY_FORM);
    setCatalog([]);
    setApiKey("");
    setError(undefined);
  }

  function edit(profile: ApiProfile) {
    setForm({
      id: profile.id,
      name: profile.name,
      preset: profile.preset,
      baseUrl: profile.baseUrl,
      models: profile.models.join(", "),
      defaultModel: profile.defaultModel ?? "",
      modelScope: profile.modelScope ?? "all",
      contexts: profile.contextWindows ?? {},
    });
    setCatalog(profile.models);
    setApiKey("");
    setStatus(undefined);
    setError(undefined);
    setEditing(true);
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
        modelScope: form.modelScope,
        contextWindows: form.contexts,
      });
      if (apiKey.trim()) await setApiProfileKey(saved.id, apiKey);
      setStatus(apiKey.trim() ? t("provider.savedWithKey") : t("provider.saved"));
      setEditing(false);
      setForm(EMPTY_FORM);
      setApiKey("");
      setCatalog([]);
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
      setDeleting(undefined);
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
      setTestResult((current) => ({ ...current, [id]: t("provider.answer", { answer: answer || t("provider.answerEmpty") }) }));
    } catch (err) {
      setTestResult((current) => ({ ...current, [id]: t("provider.failed", { error: String(err) }) }));
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
    if (info && info.suggestedModels.length > 0) setCatalog(info.suggestedModels);
  }

  /// Põe a lista que a API devolveu no formulário. O padrão fica se ainda estiver na lista; senão vai o mais barato.
  function applyModels(result: RemoteModels) {
    setForm((current) => ({
      ...current,
      models: result.ids.join(", "),
      defaultModel: result.ids.includes(current.defaultModel) ? current.defaultModel : result.cheapest ?? result.ids[0],
      contexts: result.contexts,
    }));
    setCatalog(result.ids);
  }

  /// Liga ou desliga um modelo da lista do perfil, sem perder os outros.
  function toggleModel(id: string) {
    setForm((current) => {
      const ids = current.models.split(",").map((m) => m.trim()).filter(Boolean);
      const next = ids.includes(id) ? ids.filter((m) => m !== id) : [...ids, id];
      return { ...current, models: next.join(", ") };
    });
  }

  /// Atualizar: com a chave na tela, usa ela; sem chave e com perfil salvo, usa a chave guardada.
  async function refreshModels() {
    const typedKey = apiKey.trim();
    if (!typedKey && !form.id) return;
    setRefreshing(true);
    setError(undefined);
    try {
      const result = typedKey
        ? await listProviderModels(form.preset, form.baseUrl, typedKey)
        : await refreshApiModels(form.id ?? "");
      applyModels(result);
      setStatus(t("provider.modelsFound", { count: result.ids.length }));
    } catch (err) {
      setError(String(err));
    } finally {
      setRefreshing(false);
    }
  }

  // Com a chave colada, a lista vem sozinha: basta escolher o provedor e colar a chave.
  useEffect(() => {
    const key = apiKey.trim();
    if (key.length < 8) return;
    let stale = false;
    const timer = setTimeout(() => {
      listProviderModels(form.preset, form.baseUrl, key)
        .then((result) => {
          if (stale) return;
          setError(undefined);
          if (result.ids.length > 0) applyModels(result);
        })
        .catch((err) => {
          if (!stale) setError(String(err));
        });
    }, 600);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
    // applyModels só usa o setForm do React, que não muda entre renderizações.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, form.preset, form.baseUrl]);

  return (
    <section className="settings__section" aria-labelledby="settings-providers">
      <header className="settings__section-head">
        <div>
          <h2 id="settings-providers">{t("settings.nav.providers")}</h2>
          <p className="settings__hint">{t("provider.help")}</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={openNew}>
          {t("provider.new")}
        </button>
      </header>

      {status && !editing && (
        <p role="status" className="settings__hint">
          {status}
        </p>
      )}

      {profiles.length === 0 ? (
        <p className="settings__hint">{t("provider.none")}</p>
      ) : (
        <ul className="settings-list">
          {profiles.map((p) => (
            <li key={p.id} className="settings-card">
              <div className="settings-card__head">
                <strong>{p.name}</strong>
                <span className="settings-card__meta">
                  {presetLabel(p.preset)} · {p.defaultModel ?? t("provider.noDefaultModel")} ·{" "}
                  {keyed[p.id] ? t("provider.withKey") : t("provider.noKey")}
                </span>
              </div>
              <div className="settings-actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => edit(p)}>
                  {t("provider.edit")}
                </button>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => void test(p.id)}
                  disabled={testing !== undefined || !keyed[p.id]}
                  title={keyed[p.id] ? undefined : t("provider.pasteKeyFirst")}
                >
                  {testing === p.id ? t("provider.testing") : t("provider.test")}
                </button>
                <button type="button" className="btn btn--danger btn--sm" onClick={() => setDeleting(p)}>
                  {t("common.delete")}
                </button>
              </div>
              {testResult[p.id] && <p className="settings-card__result">{testResult[p.id]}</p>}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Dialog
          title={form.id ? t("provider.editTitle") : t("provider.newTitle")}
          description={t("provider.dialogHelp")}
          onClose={closeForm}
        >
          <form className="api-form" onSubmit={(e) => void submit(e)}>
            <label>
              {t("common.name")}
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={60} />
            </label>
            <div className="provider-grid" role="radiogroup" aria-label={t("provider.label")}>
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
                  <span className="provider-card__meta">{t("provider.via", { engine: PROVIDER_LABELS[p.engine] })}</span>
                  {p.suggestedModels.length > 0 && (
                    <span className="provider-card__meta">
                      {p.suggestedModels.length === 1
                        ? t("provider.readyOne")
                        : t("provider.readyMany", { count: p.suggestedModels.length })}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <label>
              {t("provider.apiAddress")}
              <input
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder={selectedPreset?.defaultBaseUrl || t("provider.providerDefault")}
              />
            </label>
            <label>
              {t("provider.apiKey")}
              <input
                type="password"
                aria-label={t("provider.apiKey")}
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={form.id && keyed[form.id] ? t("provider.keyStoredPlaceholder") : t("provider.pasteKeyPlaceholder")}
              />
            </label>

            <fieldset className="settings__scope">
              <legend>{t("provider.models")}</legend>
              <div className="settings-actions">
                <button
                  type="button"
                  className="btn btn--sm"
                  disabled={(!apiKey.trim() && !form.id) || refreshing}
                  onClick={() => void refreshModels()}
                >
                  {refreshing ? t("provider.updating") : t("provider.fetchList")}
                </button>
                {!apiKey.trim() && !form.id && <span className="settings__hint">{t("provider.pasteKeyToFetch")}</span>}
              </div>
              {catalog.length > 0 && (
                <div className="model-picker">
                  <input
                    type="search"
                    aria-label={t("provider.searchAria")}
                    placeholder={t("provider.searchPlaceholder")}
                    value={modelQuery}
                    onChange={(e) => setModelQuery(e.target.value)}
                  />
                  <div className="model-picker__list">
                    {catalog
                      .filter((id) => id.toLowerCase().includes(modelQuery.trim().toLowerCase()))
                      .slice(0, 60)
                      .map((id) => (
                        <button
                          key={id}
                          type="button"
                          className="model-picker__item"
                          aria-pressed={form.models.split(",").some((m) => m.trim() === id)}
                          onClick={() => toggleModel(id)}
                        >
                          {id}
                        </button>
                      ))}
                  </div>
                  <p className="settings__hint">
                    {t("provider.selectedCount", { selected: form.models.split(",").filter((m) => m.trim()).length, total: catalog.length })}
                  </p>
                </div>
              )}
              <label>
                {t("provider.modelsList")}
                <input
                  value={form.models}
                  onChange={(e) => setForm({ ...form, models: e.target.value })}
                  placeholder={t("provider.modelsPlaceholder")}
                />
              </label>
              <label>
                {t("provider.defaultModel")}
                <input value={form.defaultModel} onChange={(e) => setForm({ ...form, defaultModel: e.target.value })} />
              </label>
              {(selectedPreset?.unsupportedModels?.length ?? 0) > 0 && (
                <p className="settings__hint">
                  {t("provider.unsupported")}{" "}
                  {selectedPreset?.unsupportedModels?.join(", ")}
                </p>
              )}
            </fieldset>

            {form.preset === "openRouter" && (
              <fieldset className="settings__scope">
                <legend>{t("provider.openRouterModels")}</legend>
                <label>
                  <input
                    type="radio"
                    name="model-scope"
                    checked={form.modelScope === "all"}
                    onChange={() => setForm({ ...form, modelScope: "all" })}
                  />
                  {t("provider.allModels")}
                </label>
                <label>
                  <input
                    type="radio"
                    name="model-scope"
                    checked={form.modelScope === "free"}
                    onChange={() => setForm({ ...form, modelScope: "free" })}
                  />
                  {t("provider.freeOnly")}
                </label>
              </fieldset>
            )}

            {error && (
              <p role="alert" className="message__error">
                {error}
              </p>
            )}
            <div className="api-form__actions">
              <button type="button" className="btn btn--ghost" onClick={closeForm}>
                {t("common.cancel")}
              </button>
              <button type="submit" className="btn btn--primary">
                {form.id ? t("provider.saveChanges") : t("provider.create")}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {deleting && (
        <ConfirmDialog
          title={t("provider.deleteTitle", { name: deleting.name })}
          body={t("provider.deleteBody")}
          confirmLabel={t("provider.deleteConfirm")}
          danger
          onConfirm={() => void remove(deleting.id)}
          onCancel={() => setDeleting(undefined)}
        />
      )}
    </section>
  );
}
