import { useState } from "react";
import {
  applyPalette,
  applyTheme,
  FONTS,
  loadCustomPalette,
  loadTheme,
  saveCustomPalette,
  saveTheme,
  SHAPES,
  THEMES,
  type FontId,
  type ShapeId,
  type ThemeId,
  type ThemePalette,
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

/// Cores do editor do Personalizado, na ordem em que aparecem.
const COLOR_FIELDS: Array<[keyof ThemePalette, string]> = [
  ["sidebar", "Barra lateral"],
  ["chat", "Conversa"],
  ["bubble", "Balão do usuário"],
  ["bubbleText", "Texto do balão"],
  ["accent", "Destaque"],
  ["text", "Texto"],
];

/// Página de configurações em abas: uma aba por assunto, para a página não ficar enorme.
export function SettingsView({ onClose }: SettingsViewProps) {
  const [theme, setTheme] = useState<ThemeId>(loadTheme);
  const [palette, setPalette] = useState<ThemePalette>(loadCustomPalette);
  const [tab, setTab] = useState<SettingsTab>("general");

  function choose(id: ThemeId) {
    setTheme(id);
    saveTheme(id);
    applyTheme(id);
  }

  // Cada mudança no editor vale na hora: salva e aplica no mesmo gesto.
  function changeField(field: keyof ThemePalette, value: string) {
    const next = { ...palette, [field]: value } as ThemePalette;
    setPalette(next);
    saveCustomPalette(next);
    applyPalette(next);
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
                const p = t.id === "custom" ? palette : t.palette;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={theme === t.id}
                    className="theme-card"
                    onClick={() => choose(t.id)}
                  >
                    <span className="theme-card__preview" style={{ background: p.chat }} aria-hidden="true">
                      <span className="theme-card__sidebar" style={{ background: p.sidebar }} />
                      <span className="theme-card__bubble" style={{ background: p.bubble }} />
                      <span className="theme-card__accent" style={{ background: p.accent }} />
                    </span>
                    <span className="theme-card__name">{t.label}</span>
                    <span className="theme-card__desc">{t.description}</span>
                  </button>
                );
              })}
            </div>

            {theme === "custom" && (
              <div className="custom-palette">
                <fieldset>
                  <legend>Cores</legend>
                  {COLOR_FIELDS.map(([field, label]) => (
                    <label key={field} className="custom-palette__item">
                      <input
                        type="color"
                        value={palette[field] as string}
                        onChange={(e) => changeField(field, e.target.value)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </fieldset>

                <fieldset>
                  <legend>Fonte e formato</legend>
                  <label className="custom-palette__item">
                    <span>Fonte</span>
                    <select
                      className="custom-palette__select"
                      value={palette.font}
                      onChange={(e) => changeField("font", e.target.value as FontId)}
                    >
                      {(Object.keys(FONTS) as FontId[]).map((id) => (
                        <option key={id} value={id}>
                          {FONTS[id].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="custom-palette__item">
                    <span>Componentes</span>
                    <select
                      className="custom-palette__select"
                      value={palette.shape}
                      onChange={(e) => changeField("shape", e.target.value as ShapeId)}
                    >
                      {(Object.keys(SHAPES) as ShapeId[]).map((id) => (
                        <option key={id} value={id}>
                          {SHAPES[id].label}
                        </option>
                      ))}
                    </select>
                  </label>
                </fieldset>
              </div>
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
