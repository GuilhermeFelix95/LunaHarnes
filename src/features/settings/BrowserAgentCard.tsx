import { useEffect, useState } from "react";
import { apiPresets, listApiProfiles, listModels } from "../../api";
import { agentOptions, type AgentOption } from "../../chat/agents";
import { getBrowserAgent, setBrowserAgent } from "../../chat/browserAgent";
import { profileModelOptions } from "../../chat/models";
import type { RoleModel } from "../../chat/orchestrator";
import { t } from "../../i18n";
import type { ApiPreset, ApiProfile, ModelOption } from "../../types";

/// Motor, perfil e modelo do chat no modo navegador. "Conversa atual" tira a escolha e o chat volta a seguir a conversa.
/// Cada escolha grava na hora, com a mesma lista do Orquestrador e do seletor do chat.
export function BrowserAgentCard() {
  const [choice, setChoice] = useState<RoleModel | undefined>(getBrowserAgent);
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [presets, setPresets] = useState<ApiPreset[]>([]);
  // Modelos da CLI escolhida. Perfis trazem a própria lista (ver profileModelOptions).
  const [models, setModels] = useState<ModelOption[]>([]);

  useEffect(() => {
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

  useEffect(() => {
    if (!choice || choice.profileId) return;
    listModels(choice.provider).then(setModels, () => setModels([]));
  }, [choice?.provider, choice?.profileId]);

  const options: AgentOption[] = agentOptions(profiles, presets);
  const profile = choice?.profileId ? profiles.find((p) => p.id === choice.profileId) : undefined;
  const modelOptions: ModelOption[] = choice ? (choice.profileId ? profileModelOptions(profile) : models) : [];
  const efforts = modelOptions.find((model) => model.id === choice?.model)?.efforts ?? [];

  function change(next: RoleModel | undefined) {
    setChoice(next);
    setBrowserAgent(next);
  }

  return (
    <article className="settings__card">
      <header className="settings__card-head">
        <h3 id="settings-browser-agent" className="settings__card-title">
          {t("settings.browserAgent.title")}
        </h3>
        <p className="settings__hint">{t("settings.browserAgent.help")}</p>
      </header>
      <div className="orchestrator__fields">
        <label className="orchestrator__field">
          <span>{t("settings.browserAgent.agent")}</span>
          <select
            aria-label={t("settings.browserAgent.agentLabel")}
            value={choice ? (choice.profileId ? `api:${choice.profileId}` : choice.provider) : ""}
            onChange={(event) => {
              const picked = options.find((o) => o.key === event.target.value);
              if (!picked) return void change(undefined);
              change({ provider: picked.engine, profileId: picked.profileId, model: "" });
            }}
          >
            <option value="">{t("settings.browserAgent.current")}</option>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {choice && (
          <label className="orchestrator__field">
            <span>{t("settings.browserAgent.model")}</span>
            <select
              aria-label={t("settings.browserAgent.modelLabel")}
              value={choice.model}
              onChange={(event) => {
                const next: RoleModel = { ...choice, model: event.target.value };
                // Modelo sem níveis não aceita esforço: o escolhido antes sai junto.
                if (!modelOptions.find((model) => model.id === event.target.value)?.efforts.length) delete next.effort;
                change(next);
              }}
            >
              <option value="">{t("settings.browserAgent.modelDefault")}</option>
              {modelOptions.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {choice && efforts.length > 0 && (
          <label className="orchestrator__field">
            <span>{t("settings.browserAgent.effort")}</span>
            <select
              aria-label={t("settings.browserAgent.effortLabel")}
              value={choice.effort ?? ""}
              onChange={(event) => change({ ...choice, effort: event.target.value || undefined })}
            >
              <option value="">{t("settings.browserAgent.effortDefault")}</option>
              {efforts.map((effort) => (
                <option key={effort.id} value={effort.id}>
                  {effort.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </article>
  );
}
