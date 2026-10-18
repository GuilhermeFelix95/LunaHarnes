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
  TEXT_SIZES,
  THEMES,
  type FontId,
  type ShapeId,
  type TextSizeId,
  type ThemeId,
  type ThemePalette,
} from "../../theme";
import { AccountsSection } from "./AccountsSection";
import { ApiProfilesSection } from "./ApiProfilesSection";
import { ConversationSection } from "./ConversationSection";
import { NotificationsSection } from "./NotificationsSection";
import { PluginsSection } from "./PluginsSection";
import { RulesSection } from "./RulesSection";
import { McpSection } from "./McpSection";
import { SkillsSection } from "./SkillsSection";
import { SavedThemes } from "./SavedThemes";

interface SettingsViewProps {
  onClose: () => void;
}

type SettingsSection =
  | "appearance"
  | "notifications"
  | "conversation"
  | "rules"
  | "accounts"
  | "providers"
  | "plugins"
  | "skills"
  | "mcp";

const SECTIONS: Array<[SettingsSection, string]> = [
  ["appearance", "Aparência"],
  ["notifications", "Notificações"],
  ["conversation", "Conversa"],
  ["rules", "Regras globais"],
  ["accounts", "Contas"],
  ["providers", "Provedores"],
  ["plugins", "Plugins"],
  ["skills", "Skills"],
  ["mcp", "MCP"],
];

const SECTION_KEY = "luna.settings.section";

/// Última seção aberta. Sem valor salvo (ou inválido), abre em Aparência.
function loadSection(): SettingsSection {
  try {
    const saved = localStorage.getItem(SECTION_KEY);
    // "models" era a antiga "Contas e modelos", que agora é Provedores.
    if (saved === "models") return "providers";
    const known = SECTIONS.find(([id]) => id === saved);
    if (known) return known[0];
  } catch {
    // Sem armazenamento local, abre na primeira seção.
  }
  return "appearance";
}

function saveSection(id: SettingsSection) {
  try {
    localStorage.setItem(SECTION_KEY, id);
  } catch {
    // Só a lembrança da seção se perde.
  }
}

/// Cores do editor do Personalizado, na ordem em que aparecem.
const COLOR_FIELDS: Array<[keyof ThemePalette, string]> = [
  ["sidebar", "Barra lateral"],
  ["chat", "Conversa"],
  ["bubble", "Balão do usuário"],
  ["bubbleText", "Texto do balão"],
  ["accent", "Destaque"],
  ["text", "Texto"],
  ["terminal", "Terminal"],
];

/// Opções de formato: "" = igual ao geral (balão e composer).
const SHAPE_OPTIONS = (Object.keys(SHAPES) as ShapeId[]).map((id) => ({
  value: id,
  label: SHAPES[id].label,
}));

/// Tipos de componente com formato próprio, cada um com a sua opção.
const COMPONENT_SHAPE_FIELDS = [
  ["bubbleShape", "Balão"],
  ["composerShape", "Composer"],
  ["buttonShape", "Botões"],
  ["chipShape", "Chips de ferramenta"],
  ["itemShape", "Itens da barra"],
  ["codeShape", "Blocos de código"],
] as const;

/// Página de configurações em abas: uma aba por assunto, para a página não ficar enorme.
export function SettingsView({ onClose }: SettingsViewProps) {
  const [theme, setTheme] = useState<ThemeId>(loadTheme);
  const [palette, setPalette] = useState<ThemePalette>(loadCustomPalette);
  const [section, setSection] = useState<SettingsSection>(loadSection);

  function open(id: SettingsSection) {
    setSection(id);
    saveSection(id);
  }

  function choose(id: ThemeId) {
    setTheme(id);
    saveTheme(id);
    applyTheme(id);
  }

  // Cada mudança no editor vale na hora: salva e aplica no mesmo gesto.
  function changeField(
    field: keyof ThemePalette,
    value: ThemePalette[keyof ThemePalette],
  ) {
    const next = { ...palette, [field]: value } as ThemePalette;
    setPalette(next);
    saveCustomPalette(next);
    applyPalette(next);
  }

  /// Aplicar um tema salvo: vira o Personalizado com aquelas cores.
  function applySaved(next: ThemePalette) {
    setTheme("custom");
    saveTheme("custom");
    applyTheme("custom");
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

      <div className="settings__layout">
        <nav className="settings-nav" aria-label="Seções de configurações">
          {SECTIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="settings-nav__item"
              aria-current={section === id ? "page" : undefined}
              onClick={() => open(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="settings__body">
          {section === "appearance" && (
            <section
              className="settings__section"
              aria-labelledby="settings-theme"
            >
              <h2 id="settings-theme">Tema</h2>
              <div
                className="themes"
                role="radiogroup"
                aria-labelledby="settings-theme"
              >
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
                      <span
                        className="theme-card__preview"
                        style={{ background: p.chat }}
                        aria-hidden="true"
                      >
                        <span
                          className="theme-card__sidebar"
                          style={{ background: p.sidebar }}
                        />
                        <span
                          className="theme-card__bubble"
                          style={{ background: p.bubble }}
                        />
                        <span
                          className="theme-card__accent"
                          style={{ background: p.accent }}
                        />
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
                    <legend>Texto</legend>
                    <label className="custom-palette__item">
                      <span>Fonte</span>
                      <select
                        className="custom-palette__select"
                        value={palette.font}
                        onChange={(e) =>
                          changeField("font", e.target.value as FontId)
                        }
                      >
                        {(Object.keys(FONTS) as FontId[]).map((id) => (
                          <option key={id} value={id}>
                            {FONTS[id].label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="custom-palette__item">
                      <span>Tamanho</span>
                      <select
                        className="custom-palette__select"
                        value={palette.textSize}
                        onChange={(e) =>
                          changeField("textSize", e.target.value as TextSizeId)
                        }
                      >
                        {(Object.keys(TEXT_SIZES) as TextSizeId[]).map((id) => (
                          <option key={id} value={id}>
                            {TEXT_SIZES[id].label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </fieldset>

                  <fieldset>
                    <legend>Formato</legend>
                    <label className="custom-palette__item">
                      <span>Geral</span>
                      <select
                        className="custom-palette__select"
                        value={palette.shape}
                        onChange={(e) =>
                          changeField("shape", e.target.value as ShapeId)
                        }
                      >
                        {SHAPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {COMPONENT_SHAPE_FIELDS.map(([field, label]) => (
                      <label key={field} className="custom-palette__item">
                        <span>{label}</span>
                        <select
                          className="custom-palette__select"
                          value={palette[field] ?? ""}
                          onChange={(e) =>
                            changeField(
                              field,
                              (e.target.value || null) as ShapeId | null,
                            )
                          }
                        >
                          <option value="">Igual ao geral</option>
                          {SHAPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </fieldset>

                  <fieldset>
                    <legend>Efeitos</legend>
                    <label className="custom-palette__item">
                      <input
                        type="checkbox"
                        checked={palette.glass}
                        onChange={(e) => changeField("glass", e.target.checked)}
                      />
                      <span>Vidro translúcido</span>
                    </label>
                  </fieldset>

                  <SavedThemes palette={palette} onApply={applySaved} />
                </div>
              )}
            </section>
          )}

          {section === "notifications" && <NotificationsSection />}
          {section === "conversation" && <ConversationSection />}
          {section === "rules" && <RulesSection />}
          {section === "accounts" && <AccountsSection />}
          {section === "providers" && <ApiProfilesSection />}
          {section === "plugins" && <PluginsSection />}
      {section === "skills" && <SkillsSection />}
      {section === "mcp" && <McpSection />}
        </div>
      </div>
    </div>
  );
}
