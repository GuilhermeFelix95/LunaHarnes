import { useState } from "react";
import {
  applyCustomPalette,
  applyTheme,
  loadCustomPalette,
  loadTheme,
  saveCustomPalette,
  saveTheme,
  THEMES,
  type CustomPalette,
  type ThemeId,
} from "../../theme";
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

/// Campos do editor de cores do Personalizado, na ordem em que aparecem.
const PALETTE_FIELDS: Array<[keyof CustomPalette, string]> = [
  ["sidebar", "Barra lateral"],
  ["chat", "Conversa"],
  ["bubble", "Balão do usuário"],
  ["accent", "Destaque"],
];

/// Página de configurações em abas: uma aba por assunto, para a página não ficar enorme.
export function SettingsView({ onClose }: SettingsViewProps) {
  const [theme, setTheme] = useState<ThemeId>(loadTheme);
  const [palette, setPalette] = useState<CustomPalette>(loadCustomPalette);
  const [tab, setTab] = useState<SettingsTab>("general");

  function choose(id: ThemeId) {
    setTheme(id);
    saveTheme(id);
    applyTheme(id);
  }

  // Cada cor vale na hora: salva e aplica no mesmo gesto.
  function changeColor(field: keyof CustomPalette, value: string) {
    const next = { ...palette, [field]: value };
    setPalette(next);
    saveCustomPalette(next);
    applyCustomPalette(next);
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
              {THEMES.map((t) => {
                // O cartão do Personalizado mostra as cores que o usuário escolheu.
                const preview =
                  t.id === "custom"
                    ? { bg: palette.chat, sidebar: palette.sidebar, bubble: palette.bubble, accent: palette.accent }
                    : t.preview;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={theme === t.id}
                    className="theme-card"
                    onClick={() => choose(t.id)}
                  >
                    <span className="theme-card__preview" style={{ background: preview.bg }} aria-hidden="true">
                      <span className="theme-card__sidebar" style={{ background: preview.sidebar }} />
                      <span className="theme-card__bubble" style={{ background: preview.bubble }} />
                      <span className="theme-card__accent" style={{ background: preview.accent }} />
                    </span>
                    <span className="theme-card__name">{t.label}</span>
                    <span className="theme-card__desc">{t.description}</span>
                  </button>
                );
              })}
            </div>

            {theme === "custom" && (
              <fieldset className="custom-palette">
                <legend>Cores do Personalizado</legend>
                {PALETTE_FIELDS.map(([field, label]) => (
                  <label key={field} className="custom-palette__item">
                    <input
                      type="color"
                      value={palette[field]}
                      onChange={(e) => changeColor(field, e.target.value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
            )}
          </section>

          <NotificationsSection />
        </>
      )}

      {tab === "models" && <ApiProfilesSection />}
      {tab === "plugins" && <PluginsSection />}
    </div>
  );
}
