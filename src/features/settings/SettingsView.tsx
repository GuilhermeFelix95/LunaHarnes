import { useState } from "react";
import {
  applyLiquidGlass,
  applyPalette,
  applyTheme,
  FONTS,
  loadCustomPalette,
  loadLiquidGlass,
  loadTheme,
  saveLiquidGlass,
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
import { t, useLocale, type MessageKey } from "../../i18n";
import { AccountsSection } from "./AccountsSection";
import { ProvidersSection } from "./ProvidersSection";
import { ConversationSection } from "./ConversationSection";
import { GeneralSection } from "./GeneralSection";
import { NotificationsSection } from "./NotificationsSection";
import { PluginsSection } from "./PluginsSection";
import { RulesSection } from "./RulesSection";
import { McpSection } from "./McpSection";
import { SkillsSection } from "./SkillsSection";
import { SavedThemes } from "./SavedThemes";
import { PluginThemePicker } from "./PluginThemePicker";
import { applyPluginTheme, savePluginThemeKey } from "../../plugins/themeRegistry";
import { loadSavedThemes, saveSavedThemes, type SavedTheme } from "../../themeShare";

interface SettingsViewProps {
  onClose: () => void;
}

type SettingsSection =
  | "appearance"
  | "general"
  | "notifications"
  | "conversation"
  | "rules"
  | "accounts"
  | "providers"
  | "plugins"
  | "skills"
  | "mcp";

const SECTIONS: Array<[SettingsSection, MessageKey]> = [
  ["appearance", "settings.nav.appearance"],
  ["general", "settings.nav.general"],
  ["notifications", "settings.nav.notifications"],
  ["conversation", "settings.nav.conversation"],
  ["rules", "settings.nav.rules"],
  ["accounts", "settings.nav.accounts"],
  ["providers", "settings.nav.providers"],
  ["plugins", "settings.nav.plugins"],
  ["skills", "settings.nav.skills"],
  ["mcp", "settings.nav.mcp"],
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

/// Nome e descrição de cada tema de fábrica, traduzidos pela chave.
const THEME_TEXT: Record<ThemeId, { name: MessageKey; desc: MessageKey }> = {
  luna: { name: "settings.theme.luna.name", desc: "settings.theme.luna.desc" },
  codex: { name: "settings.theme.codex.name", desc: "settings.theme.codex.desc" },
  terminal: { name: "settings.theme.terminal.name", desc: "settings.theme.terminal.desc" },
  pixel: { name: "settings.theme.pixel.name", desc: "settings.theme.pixel.desc" },
  "meia-noite": { name: "settings.theme.meiaNoite.name", desc: "settings.theme.meiaNoite.desc" },
  neon: { name: "settings.theme.neon.name", desc: "settings.theme.neon.desc" },
  "luna-claro": { name: "settings.theme.lunaClaro.name", desc: "settings.theme.lunaClaro.desc" },
  claude: { name: "settings.theme.claude.name", desc: "settings.theme.claude.desc" },
  cereja: { name: "settings.theme.cereja.name", desc: "settings.theme.cereja.desc" },
  "por-do-sol": { name: "settings.theme.porDoSol.name", desc: "settings.theme.porDoSol.desc" },
  lavanda: { name: "settings.theme.lavanda.name", desc: "settings.theme.lavanda.desc" },
  floresta: { name: "settings.theme.floresta.name", desc: "settings.theme.floresta.desc" },
  custom: { name: "settings.theme.custom.name", desc: "settings.theme.custom.desc" },
};

const FONT_KEYS: Record<FontId, MessageKey> = {
  inter: "settings.font.inter",
  segoe: "settings.font.segoe",
  calibri: "settings.font.calibri",
  arial: "settings.font.arial",
  verdana: "settings.font.verdana",
  georgia: "settings.font.georgia",
  palatino: "settings.font.palatino",
  consolas: "settings.font.consolas",
  cascadia: "settings.font.cascadia",
  vt323: "settings.font.vt323",
  press: "settings.font.press",
  silkscreen: "settings.font.silkscreen",
  outfit: "settings.font.outfit",
  "space-grotesk": "settings.font.spaceGrotesk",
  fraunces: "settings.font.fraunces",
  lora: "settings.font.lora",
  jetbrains: "settings.font.jetbrains",
};

const SHAPE_KEYS: Record<ShapeId, MessageKey> = {
  square: "settings.shape.square",
  soft: "settings.shape.soft",
  round: "settings.shape.round",
  bubbly: "settings.shape.bubbly",
  pill: "settings.shape.pill",
  leaf: "settings.shape.leaf",
  diagonal: "settings.shape.diagonal",
  top: "settings.shape.top",
  bubble: "settings.shape.bubble",
  wave: "settings.shape.wave",
};

const SIZE_KEYS: Record<TextSizeId, MessageKey> = {
  small: "settings.size.small",
  medium: "settings.size.medium",
  large: "settings.size.large",
};

/// Cores do editor do Personalizado, na ordem em que aparecem.
const COLOR_FIELDS: Array<[keyof ThemePalette, MessageKey]> = [
  ["sidebar", "settings.color.sidebar"],
  ["chat", "settings.color.chat"],
  ["bubble", "settings.color.bubble"],
  ["bubbleText", "settings.color.bubbleText"],
  ["accent", "settings.color.accent"],
  ["text", "settings.appearance.text"],
  ["terminal", "settings.color.terminal"],
];

/// Formatos disponíveis, na ordem do seletor.
const SHAPE_IDS = Object.keys(SHAPES) as ShapeId[];

/// Tipos de componente com formato próprio, cada um com a sua opção.
const COMPONENT_SHAPE_FIELDS = [
  ["bubbleShape", "settings.shapeField.bubble"],
  ["composerShape", "settings.shapeField.composer"],
  ["buttonShape", "settings.shapeField.button"],
  ["chipShape", "settings.shapeField.chip"],
  ["itemShape", "settings.shapeField.item"],
  ["codeShape", "settings.shapeField.code"],
  ["cardShape", "settings.shapeField.card"],
  ["inputShape", "settings.shapeField.input"],
] as const;

/// Página de configurações em abas: uma aba por assunto, para a página não ficar enorme.
export function SettingsView({ onClose }: SettingsViewProps) {
  useLocale();
  const [theme, setTheme] = useState<ThemeId>(loadTheme);
  const [palette, setPalette] = useState<ThemePalette>(loadCustomPalette);
  const [section, setSection] = useState<SettingsSection>(loadSection);
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>(loadSavedThemes);
  const [activeName, setActiveName] = useState<string | null>(loadActiveName);
  const [liquid, setLiquid] = useState<boolean>(loadLiquidGlass);
  /// Modo de edição: some a lista de temas de fábrica e fica só Seus temas com o editor.
  const [editing, setEditing] = useState(false);

  function open(id: SettingsSection) {
    setSection(id);
    saveSection(id);
  }

  function toggleLiquid(on: boolean) {
    setLiquid(on);
    saveLiquidGlass(on);
    applyLiquidGlass(on);
  }

  function choose(id: ThemeId) {
    setTheme(id);
    saveTheme(id);
    applyTheme(id);
    // Um tema do app tira o de plugin, senão os tokens do plugin continuam por cima.
    savePluginThemeKey(null);
    applyPluginTheme(null);
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
    if (activeName) storeSaved(savedThemes.map((saved) => (saved.name === activeName ? { ...saved, palette: next } : saved)));
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
    while (savedThemes.some((saved) => saved.name === t("settings.appearance.defaultThemeName", { index }))) index++;
    const created: SavedTheme = { name: t("settings.appearance.defaultThemeName", { index }), palette };
    storeSaved([...savedThemes, created]);
    applySaved(created);
    setEditing(true);
  }

  function importTheme(imported: SavedTheme) {
    storeSaved([...savedThemes.filter((saved) => saved.name !== imported.name), imported]);
    applySaved(imported);
  }

  /// Remove um tema salvo. Se era o ativo, volta para o Luna.
  function removeSaved(name: string) {
    storeSaved(savedThemes.filter((saved) => saved.name !== name));
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
        <h1>{t("settings.title")}</h1>
        <button type="button" className="btn btn--sm" onClick={onClose}>
          {t("settings.back")}
        </button>
      </header>

      <div className="settings__layout">
        <nav className="settings-nav" aria-label={t("settings.sectionsNav")}>
          {SECTIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="settings-nav__item"
              aria-current={section === id ? "page" : undefined}
              onClick={() => open(id)}
            >
              {t(label)}
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
                  <h2 id="settings-user-themes">{t("settings.appearance.yourThemes")}</h2>
                  <button type="button" className="btn btn--sm" onClick={() => setEditing(false)}>
                    {t("settings.appearance.backToThemes")}
                  </button>
                </div>
              ) : (
                <>
                  <h2 id="settings-theme">{t("settings.appearance.theme")}</h2>
                  <label className="custom-palette__item">
                    <input type="checkbox" checked={liquid} onChange={(e) => toggleLiquid(e.target.checked)} />
                    <span>{t("settings.appearance.liquidGlass")}</span>
                  </label>
                  {[
                    { title: t("settings.appearance.light"), dark: false },
                    { title: t("settings.appearance.dark"), dark: true },
                  ].map(({ title, dark }) => (
                    <div key={title}>
                      <h3 id={`settings-${dark ? "dark" : "light"}`} className="settings__subhead">
                        {title}
                      </h3>
                      <div className="themes" role="radiogroup" aria-labelledby={`settings-${dark ? "dark" : "light"}`}>
                        {THEMES.filter((th) => th.id !== "custom" && isDarkPalette(th.palette) === dark).map((th) => (
                          <ThemeCard
                            key={th.id}
                            label={t(THEME_TEXT[th.id].name)}
                            description={t(THEME_TEXT[th.id].desc)}
                            palette={th.palette}
                            checked={theme === th.id}
                            onChoose={() => choose(th.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  <PluginThemePicker />

                  <h3 id="settings-user-themes" className="settings__subhead">
                    {t("settings.appearance.yourThemes")}
                  </h3>
                </>
              )}
              <div
                className="themes"
                role="radiogroup"
                aria-labelledby="settings-user-themes"
              >
                {savedThemes.map((saved) => (
                  <div key={saved.name} className="theme-card-wrap">
                    <ThemeCard
                      label={saved.name}
                      description={t("settings.appearance.yourThemeDesc")}
                      palette={saved.palette}
                      checked={theme === "custom" && activeName === saved.name}
                      onChoose={() => applySaved(saved)}
                    />
                    <button
                      type="button"
                      className="theme-card__remove"
                      aria-label={t("settings.appearance.removeTheme", { name: saved.name })}
                      title={t("settings.appearance.removeThemeTitle")}
                      onClick={() => removeSaved(saved.name)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" className="theme-card theme-card--new" onClick={createTheme}>
                  <span className="theme-card__plus" aria-hidden="true">+</span>
                  <span className="theme-card__name">{t("settings.appearance.newTheme")}</span>
                  <span className="theme-card__desc">{t("settings.appearance.newThemeDesc")}</span>
                </button>
              </div>

              {theme === "custom" && (
                <div className="custom-palette">
                  <fieldset>
                    <legend>{t("settings.appearance.colors")}</legend>
                    {COLOR_FIELDS.map(([field, label]) => (
                      <label key={field} className="custom-palette__item">
                        <input
                          type="color"
                          value={palette[field] as string}
                          onChange={(e) => changeField(field, e.target.value)}
                        />
                        <span>{t(label)}</span>
                      </label>
                    ))}
                  </fieldset>

                  <fieldset>
                    <legend>{t("settings.appearance.text")}</legend>
                    <label className="custom-palette__item">
                      <span>{t("settings.appearance.font")}</span>
                      <select
                        className="custom-palette__select"
                        value={palette.font}
                        onChange={(e) =>
                          changeField("font", e.target.value as FontId)
                        }
                      >
                        {(Object.keys(FONTS) as FontId[]).map((id) => (
                          <option key={id} value={id}>
                            {t(FONT_KEYS[id])}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="custom-palette__item">
                      <span>{t("settings.appearance.size")}</span>
                      <select
                        className="custom-palette__select"
                        value={palette.textSize}
                        onChange={(e) =>
                          changeField("textSize", e.target.value as TextSizeId)
                        }
                      >
                        {(Object.keys(TEXT_SIZES) as TextSizeId[]).map((id) => (
                          <option key={id} value={id}>
                            {t(SIZE_KEYS[id])}
                          </option>
                        ))}
                      </select>
                    </label>
                  </fieldset>

                  <fieldset>
                    <legend>{t("settings.appearance.format")}</legend>
                    <label className="custom-palette__item">
                      <span>{t("settings.appearance.general")}</span>
                      <select
                        className="custom-palette__select"
                        value={palette.shape}
                        onChange={(e) =>
                          changeField("shape", e.target.value as ShapeId)
                        }
                      >
                        {SHAPE_IDS.map((id) => (
                          <option key={id} value={id}>
                            {t(SHAPE_KEYS[id])}
                          </option>
                        ))}
                      </select>
                    </label>
                    {COMPONENT_SHAPE_FIELDS.map(([field, label]) => (
                      <label key={field} className="custom-palette__item">
                        <span>{t(label)}</span>
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
                          <option value="">{t("settings.appearance.sameAsGeneral")}</option>
                          {SHAPE_IDS.map((id) => (
                            <option key={id} value={id}>
                              {t(SHAPE_KEYS[id])}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </fieldset>

                  <fieldset>
                    <legend>{t("settings.appearance.effects")}</legend>
                    <label className="custom-palette__item">
                      <input
                        type="checkbox"
                        checked={palette.glass}
                        onChange={(e) => changeField("glass", e.target.checked)}
                      />
                      <span>{t("settings.appearance.glass")}</span>
                    </label>
                  </fieldset>

                  {activeName && (
                    <div className="api-form__actions">
                      <button type="button" className="btn btn--danger" onClick={deleteActive}>
                        {t("settings.appearance.delete", { name: activeName })}
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

          {section === "general" && <GeneralSection />}
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
