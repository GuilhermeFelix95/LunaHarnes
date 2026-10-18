import { useState } from "react";
import { applyTheme, loadTheme, saveTheme, THEMES, type ThemeId } from "../../theme";
import { ApiProfilesSection } from "./ApiProfilesSection";
import { NotificationsSection } from "./NotificationsSection";
import { PluginsSection } from "./PluginsSection";

interface SettingsViewProps {
  onClose: () => void;
}

type SettingsTab = "general" | "models" | "plugins";

const TABS: Array<[SettingsTab, string]> = [
  ["general", "Geral"],
  ["models", "Modelos e APIs"],
  ["plugins", "Plugins"],
];

/// Página de configurações em abas: uma aba por assunto, para a página não ficar enorme.
export function SettingsView({ onClose }: SettingsViewProps) {
  const [theme, setTheme] = useState<ThemeId>(loadTheme);
  const [tab, setTab] = useState<SettingsTab>("general");

  function choose(id: ThemeId) {
    setTheme(id);
    saveTheme(id);
    applyTheme(id);
  }

  return (
    <div className="settings">
      <header className="settings__head">
        <h1>Configurações</h1>
        <button type="button" className="btn btn--sm" onClick={onClose}>
          Voltar ao chat
        </button>
      </header>

      <div className="segmented" role="tablist" aria-label="Seções de configurações">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <>
          <section className="settings__section" aria-labelledby="settings-theme">
            <h2 id="settings-theme">Tema</h2>
            <div className="themes" role="radiogroup" aria-labelledby="settings-theme">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.id}
                  className="theme-card"
                  onClick={() => choose(t.id)}
                >
                  <span className="theme-card__preview" style={{ background: t.preview.bg }} aria-hidden="true">
                    <span className="theme-card__sidebar" style={{ background: t.preview.sidebar }} />
                    <span className="theme-card__bubble" style={{ background: t.preview.bubble }} />
                    <span className="theme-card__accent" style={{ background: t.preview.accent }} />
                  </span>
                  <span className="theme-card__name">{t.label}</span>
                  <span className="theme-card__desc">{t.description}</span>
                </button>
              ))}
            </div>
          </section>

          <NotificationsSection />
        </>
      )}

      {tab === "models" && <ApiProfilesSection />}
      {tab === "plugins" && <PluginsSection />}
    </div>
  );
}
