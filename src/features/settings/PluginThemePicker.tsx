import { useState } from "react";
import { t } from "../../i18n";
import { applyPluginTheme, listPluginThemes, loadPluginThemeKey, savePluginThemeKey } from "../../plugins/themeRegistry";

/** Escolha entre o padrão do app e os temas registrados pelos plugins ativos. */
export function PluginThemePicker() {
  const [selected, setSelected] = useState<string | null>(loadPluginThemeKey);
  const themes = listPluginThemes();

  function choose(key: string | null) {
    setSelected(key);
    savePluginThemeKey(key);
    applyPluginTheme(key);
  }

  return (
    <div className="plugin-themes">
      <h3>{t("settings.appearance.pluginThemes")}</h3>
      {themes.length === 0 && <p className="settings__hint">{t("settings.appearance.pluginThemesNone")}</p>}
      <label className="custom-palette__item">
        <input type="radio" name="plugin-theme" checked={selected === null} onChange={() => choose(null)} />
        <span>{t("settings.appearance.pluginThemeDefault")}</span>
      </label>
      {themes.map((theme) => (
        <label key={theme.key} className="custom-palette__item">
          <input
            type="radio"
            name="plugin-theme"
            checked={selected === theme.key}
            onChange={() => choose(theme.key)}
            aria-label={`${theme.name} · ${theme.pluginId}`}
          />
          <span>
            {theme.name} <small>· {theme.pluginId}</small>
          </span>
        </label>
      ))}
    </div>
  );
}
