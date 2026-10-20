import { useEffect, useState } from "react";
import { apiPresets, getOrchestrator, listApiProfiles, listModels, saveOrchestrator } from "../../api";
import { agentOptions, type AgentOption } from "../../chat/agents";
import { ROLES, type Orchestrator, type OrchestratorRole, type RoleModel } from "../../chat/orchestrator";
import { profileModelOptions } from "../../chat/models";
import { t, type MessageKey } from "../../i18n";
import type { ApiPreset, ApiProfile, ModelOption, ProviderKind } from "../../types";

const ROLE_KEYS: Record<OrchestratorRole, MessageKey> = {
  plan: "orchestrator.role.plan",
  execute: "orchestrator.role.execute",
  chat: "orchestrator.role.chat",
  subagent: "orchestrator.role.subagent",
};

/// Chave do agente escolhido num papel: a CLI ("claude") ou o perfil ("api:<id>"), como no seletor do chat.
function keyOf(choice: RoleModel): string {
  return choice.profileId ? `api:${choice.profileId}` : choice.provider;
}

/// Escolha de modelo por papel. Cada escolha grava na hora; "conversa atual" tira a escolha do papel.
/// Um papel pode usar uma CLI ou um perfil de API, com a mesma lista do seletor do chat.
/// O subagente só existe no Claude sem perfil, então o papel de subagentes oferece só essa opção.
export function OrchestratorSection() {
  const [config, setConfig] = useState<Orchestrator>({});
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [presets, setPresets] = useState<ApiPreset[]>([]);
  // Modelos das CLIs, por motor. Perfis trazem a própria lista (ver profileModelOptions).
  const [models, setModels] = useState<Partial<Record<ProviderKind, ModelOption[]>>>({});
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    getOrchestrator().then(setConfig, () => setConfig({}));
    Promise.all([listApiProfiles(), apiPresets()]).then(
      ([list, known]) => {
        setProfiles(list);
        setPresets(known);
      },
      () => {
        setProfiles([]);
        setPresets([]);
      },
    );
  }, []);

  // Carrega a lista de cada CLI escolhida, uma vez.
  useEffect(() => {
    for (const role of ROLES) {
      const choice = config[role];
      if (!choice || choice.profileId || models[choice.provider]) continue;
      listModels(choice.provider).then(
        (list) => setModels((current) => ({ ...current, [choice.provider]: list })),
        () => setModels((current) => ({ ...current, [choice.provider]: [] })),
      );
    }
  }, [config, models]);

  const options: AgentOption[] = agentOptions(profiles, presets);

  async function change(role: OrchestratorRole, choice: RoleModel | undefined) {
    const next: Orchestrator = { ...config, [role]: choice };
    setConfig(next);
    setError(undefined);
    // Escolha sem modelo ainda não é válida: espera a pessoa escolher o modelo.
    if (choice && !choice.model) return;
    // Os outros papéis sem modelo não vão ao Rust (ele recusaria o modelo vazio e o salvamento falharia).
    const complete = Object.fromEntries(Object.entries(next).filter(([, c]) => c?.model)) as Orchestrator;
    try {
      await saveOrchestrator(complete);
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
        const roleOptions = role === "subagent" ? options.filter((o) => o.engine === "claude" && !o.profileId) : options;
        const profile = choice?.profileId ? profiles.find((p) => p.id === choice.profileId) : undefined;
        const modelOptions: ModelOption[] = choice ? (choice.profileId ? profileModelOptions(profile) : (models[choice.provider] ?? [])) : [];
        const noModels = !!choice && !choice.profileId && models[choice.provider]?.length === 0;
        return (
          <div className="settings__row" key={role}>
            <label>
              <span>{t(ROLE_KEYS[role])}</span>
              <select
                aria-label={t(ROLE_KEYS[role])}
                value={choice ? keyOf(choice) : ""}
                onChange={(event) => {
                  const key = event.target.value;
                  if (!key) return void change(role, undefined);
                  const picked = roleOptions.find((o) => o.key === key);
                  if (!picked) return;
                  void change(role, { provider: picked.engine, profileId: picked.profileId, model: "" });
                }}
              >
                <option value="">{t("orchestrator.current")}</option>
                {roleOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {choice && (
              <label>
                <select
                  aria-label={t("orchestrator.model")}
                  value={choice.model}
                  onChange={(event) => void change(role, { ...choice, model: event.target.value })}
                >
                  <option value="">—</option>
                  {modelOptions.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
                {noModels && <span className="settings__hint">{t("orchestrator.noModels")}</span>}
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
