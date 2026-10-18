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
  DEFAULT_THEME,
  THEMES,
  isDarkPalette,
  type FontId,
  type ShapeId,
  type TextSizeId,
  type ThemeId,
  type ThemePalette,
} from "../../theme";
import { AccountsSection } from "./AccountsSection";
import { ProvidersSection } from "./ProvidersSection";
import { ConversationSection } from "./ConversationSection";
import { NotificationsSection } from "./NotificationsSection";
import { PluginsSection } from "./PluginsSection";
import { RulesSection } from "./RulesSection";
import { McpSection } from "./McpSection";
import { SkillsSection } from "./SkillsSection";
import { SavedThemes } from "./SavedThemes";
import { loadSavedThemes, saveSavedThemes, type SavedTheme } from "../../themeShare";

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
const ACTIVE_THEME_KEY = "luna.activeCustomTheme";

/// Nome do tema personalizado que está sendo editado. Sem valor, o editor vale só para o tema ativo sem cartão.
function loadActiveName(): string | null {
  try {
    return localStorage.getItem(ACTIVE_THEME_KEY);
  } catch {
    return null;
  }
}

function saveActiveName(name: string | null) {
  try {
    if (name) localStorage.setItem(ACTIVE_THEME_KEY, name);
    else localStorage.removeItem(ACTIVE_THEME_KEY);
  } catch {
    // Só a lembrança do tema ativo se perde.
  }
}

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

/// Cartão de tema: prévia com as cores da paleta, nome e descrição. Escolher aplica na hora.
function ThemeCard({
  label,
  description,
  palette,
  checked,
  onChoose,
}: {
  label: string;
  description: string;
  palette: ThemePalette;
  checked: boolean;
  onChoose: () => void;
}) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="theme-card" onClick={onChoose}>
      <span className="theme-card__preview" style={{ background: palette.chat }} aria-hidden="true">
        <span className="theme-card__sidebar" style={{ background: palette.sidebar }} />
        <span className="theme-card__bubble" style={{ background: palette.bubble }} />
        <span className="theme-card__accent" style={{ background: palette.accent }} />
      </span>
      <span className="theme-card__name">{label}</span>
      <span className="theme-card__desc">{description}</span>
    </button>
  );
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
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>(loadSavedThemes);
  const [activeName, setActiveName] = useState<string | null>(loadActiveName);
  /// Modo de edição: some a lista de temas de fábrica e fica só Seus temas com o editor.
  const [editing, setEditing] = useState(false);

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
    // O tema ativo acompanha a edição, então o cartão dele mostra as cores novas.
    if (activeName) storeSaved(savedThemes.map((t) => (t.name === activeName ? { ...t, palette: next } : t)));
  }

  function storeSaved(next: SavedTheme[]) {
    setSavedThemes(next);
    saveSavedThemes(next);
  }

  /// Aplicar um tema salvo: vira o tema ativo, com as cores dele.
  function applySaved(saved: SavedTheme) {
    setTheme("custom");
    saveTheme("custom");
    saveCustomPalette(saved.palette);
    applyTheme("custom");
    setPalette(saved.palette);
    setActiveName(saved.name);
    saveActiveName(saved.name);
  }

  /// Novo tema: começa com as cores atuais e já vira o tema ativo, com cartão na lista.
  function createTheme() {
    let index = savedThemes.length + 1;
    while (savedThemes.some((t) => t.name === `Tema ${index}`)) index++;
    const created: SavedTheme = { name: `Tema ${index}`, palette };
    storeSaved([...savedThemes, created]);
    applySaved(created);
    setEditing(true);
  }

  function importTheme(imported: SavedTheme) {
    storeSaved([...savedThemes.filter((t) => t.name !== imported.name), imported]);
    applySaved(imported);
  }

  /// Remove um tema salvo. Se era o ativo, volta para o Luna.
  function removeSaved(name: string) {
    storeSaved(savedThemes.filter((t) => t.name !== name));
    if (activeName === name) {
      setActiveName(null);
      saveActiveName(null);
      choose(DEFAULT_THEME);
    }
  }

  function deleteActive() {
    if (activeName) removeSaved(activeName);
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
              {editing ? (
                <div className="settings__head">
                  <h2 id="settings-user-themes">Seus temas</h2>
                  <button type="button" className="btn btn--sm" onClick={() => setEditing(false)}>
                    Voltar aos temas
                  </button>
                </div>
              ) : (
                <>
                  <h2 id="settings-theme">Tema</h2>
                  {[
                    { title: "Claros", dark: false },
                    { title: "Noturnos", dark: true },
                  ].map(({ title, dark }) => (
                    <div key={title}>
                      <h3 id={`settings-${dark ? "dark" : "light"}`} className="settings__subhead">
                        {title}
                      </h3>
                      <div className="themes" role="radiogroup" aria-labelledby={`settings-${dark ? "dark" : "light"}`}>
                        {THEMES.filter((t) => t.id !== "custom" && isDarkPalette(t.palette) === dark).map((t) => (
                          <ThemeCard
                            key={t.id}
                            label={t.label}
                            description={t.description}
                            palette={t.palette}
                            checked={theme === t.id}
                            onChoose={() => choose(t.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  <h3 id="settings-user-themes" className="settings__subhead">
                    Seus temas
                  </h3>
                </>
              )}
              <div
                className="themes"
                role="radiogroup"
                aria-labelledby="settings-user-themes"
              >
                {savedThemes.map((t) => (
                  <div key={t.name} className="theme-card-wrap">
                    <ThemeCard
                      label={t.name}
                      description="Seu tema"
                      palette={t.palette}
                      checked={theme === "custom" && activeName === t.name}
                      onChoose={() => applySaved(t)}
                    />
                    <button
                      type="button"
                      className="theme-card__remove"
                      aria-label={`Remover ${t.name}`}
                      title="Remover este tema"
                      onClick={() => removeSaved(t.name)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" className="theme-card theme-card--new" onClick={createTheme}>
                  <span className="theme-card__plus" aria-hidden="true">+</span>
                  <span className="theme-card__name">Novo tema</span>
                  <span className="theme-card__desc">Começa com as cores atuais do editor</span>
                </button>
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

                  {activeName && (
                    <div className="api-form__actions">
                      <button type="button" className="btn btn--danger" onClick={deleteActive}>
                        Excluir "{activeName}"
                      </button>
                    </div>
                  )}
                  <SavedThemes
                    active={activeName ? { name: activeName, palette } : null}
                    onImport={importTheme}
                  />
                </div>
              )}
            </section>
          )}

          {section === "notifications" && <NotificationsSection />}
          {section === "conversation" && <ConversationSection />}
          {section === "rules" && <RulesSection />}
          {section === "accounts" && <AccountsSection />}
          {section === "providers" && <ProvidersSection />}
          {section === "plugins" && <PluginsSection />}
      {section === "skills" && <SkillsSection />}
      {section === "mcp" && <McpSection />}
        </div>
      </div>
    </div>
  );
}
