import { useState } from "react";
import { applyTheme, loadTheme, saveTheme, THEMES, type ThemeId } from "../../theme";
import { ApiProfilesSection } from "./ApiProfilesSection";
import { PluginsSection } from "./PluginsSection";
import { NotificationsSection } from "./NotificationsSection";

interface SettingsViewProps {
  onClose: () => void;
}

/// Página de configurações: tema, login das CLIs, perfis de API e plugins.
export function SettingsView({ onClose }: SettingsViewProps) {
  const [theme, setTheme] = useState<ThemeId>(loadTheme);

  function choose(id: ThemeId) {
    setTheme(id);
    saveTheme(id);
    applyTheme(id);
  }

  return (
    <div className="settings">
      <header className="settings__head">
        <h1>Configurações</h1>
        <button type="button" className="settings__close" onClick={onClose}>
          Voltar ao chat
        </button>
      </header>

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

      <ApiProfilesSection />

      <PluginsSection />

      <NotificationsSection />
    </div>
  );
}
