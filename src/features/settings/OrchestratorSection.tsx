import { useEffect, useState } from "react";
import { getOrchestrator, listModels, saveOrchestrator } from "../../api";
import { ROLES, type Orchestrator, type OrchestratorRole, type RoleModel } from "../../chat/orchestrator";
import { t, type MessageKey } from "../../i18n";
import type { ModelOption, ProviderKind } from "../../types";

const PROVIDERS: ProviderKind[] = ["claude", "codex", "opencode", "cline", "copilot"];

const ROLE_KEYS: Record<OrchestratorRole, MessageKey> = {
  plan: "orchestrator.role.plan",
  execute: "orchestrator.role.execute",
  chat: "orchestrator.role.chat",
  subagent: "orchestrator.role.subagent",
};

/// Escolha de modelo por papel. Cada escolha grava na hora; "conversa atual" tira a escolha do papel.
/// O subagente só existe no Claude, então o papel de subagentes oferece só os modelos dele.
export function OrchestratorSection() {
  const [config, setConfig] = useState<Orchestrator>({});
  const [models, setModels] = useState<Partial<Record<ProviderKind, ModelOption[]>>>({});
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    getOrchestrator().then(setConfig, () => setConfig({}));
  }, []);

  // Carrega a lista de cada motor escolhido, uma vez.
  useEffect(() => {
    for (const role of ROLES) {
      const provider = config[role]?.provider;
      if (!provider || models[provider]) continue;
      listModels(provider).then(
        (list) => setModels((current) => ({ ...current, [provider]: list })),
        () => setModels((current) => ({ ...current, [provider]: [] })),
      );
    }
  }, [config, models]);

  async function change(role: OrchestratorRole, choice: RoleModel | undefined) {
    const next: Orchestrator = { ...config, [role]: choice };
    setConfig(next);
    setError(undefined);
    // Escolha sem modelo ainda não é válida: espera a pessoa escolher o modelo.
    if (choice && !choice.model) return;
    try {
      await saveOrchestrator(next);
    } catch (e) {
      setError(t("orchestrator.saveError", { error: String(e) }));
    }
  }

  return (
    <section className="settings__section" aria-labelledby="orchestrator-title">
      <h2 id="orchestrator-title">{t("orchestrator.title")}</h2>
      <p className="settings__hint">{t("orchestrator.help")}</p>
      <p className="settings__hint">{t("orchestrator.subagentNote")}</p>

      {ROLES.map((role) => {
        const choice = config[role];
        const providers = role === "subagent" ? (["claude"] as ProviderKind[]) : PROVIDERS;
        const options = choice ? (models[choice.provider] ?? []) : [];
        return (
          <div className="settings__row" key={role}>
            <label>
              <span>{t(ROLE_KEYS[role])}</span>
              <select
                value={choice?.provider ?? ""}
                onChange={(event) => {
                  const provider = event.target.value as ProviderKind | "";
                  if (!provider) return void change(role, undefined);
                  void change(role, { provider, model: "" });
                }}
              >
                <option value="">{t("orchestrator.current")}</option>
                {providers.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            {choice && (
              <label>
                
                <select value={choice.model} onChange={(event) => void change(role, { ...choice, model: event.target.value })}>
                  <option value="">—</option>
                  {options.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
                {models[choice.provider]?.length === 0 && <span className="settings__hint">{t("orchestrator.noModels")}</span>}
              </label>
            )}
          </div>
        );
      })}

      {error && (
        <p role="alert" className="settings__hint">
          {error}
        </p>
      )}
    </section>
  );
}
