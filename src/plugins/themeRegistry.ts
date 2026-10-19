import type { PluginTheme } from "./host";

/** Escolha do tema de plugin, como `plugin:<pluginId>/<id>`. Vazia ou ausente = nenhum tema de plugin. */
export const PLUGIN_THEME_KEY = "luna.pluginTheme";
const STYLE_ID = "luna-plugin-theme";

export interface RegisteredPluginTheme extends PluginTheme {
  /** `plugin:<pluginId>/<id>`: o nome que a escolha guarda. */
  key: string;
  pluginId: string;
}

// Global: cada conversa tem um host de plugins, mas o tema vale para o app inteiro.
const registry = new Map<string, RegisteredPluginTheme>();
let applied: { key: string; tokens: string[] } | null = null;

export function pluginThemeKey(pluginId: string, id: string): string {
  return `plugin:${pluginId}/${id}`;
}

export function listPluginThemes(): RegisteredPluginTheme[] {
  return [...registry.values()];
}

export function loadPluginThemeKey(): string | null {
  try {
    return localStorage.getItem(PLUGIN_THEME_KEY);
  } catch {
    return null;
  }
}

export function savePluginThemeKey(key: string | null) {
  try {
    if (key) localStorage.setItem(PLUGIN_THEME_KEY, key);
    else localStorage.removeItem(PLUGIN_THEME_KEY);
  } catch {
    // Sem armazenamento (modo privado, por exemplo): a escolha vale só nesta sessão.
  }
}

/** Substitui todos os temas de plugin pelos que os plugins ativos registraram. Cada host de conversa chama isso ao carregar. */
export function setPluginThemes(themes: (PluginTheme & { pluginId: string })[]) {
  registry.clear();
  for (const theme of themes) {
    const key = pluginThemeKey(theme.pluginId, theme.id);
    registry.set(key, { ...theme, key });
  }
  // O tema escolhido sumiu (plugin desligado ou removido): tira do <html>.
  if (applied && !registry.has(applied.key)) applyPluginTheme(null);
  // A escolha salva ganha vida quando o plugin carrega, mesmo depois do início do app.
  const saved = loadPluginThemeKey();
  if (saved && applied?.key !== saved && registry.has(saved)) applyPluginTheme(saved);
}

/** Aplica o tema de plugin de `key`, ou tira o atual com `null`. Chave desconhecida também tira. */
export function applyPluginTheme(key: string | null, root: HTMLElement = document.documentElement) {
  if (applied) {
    for (const token of applied.tokens) root.style.removeProperty(token);
    document.getElementById(STYLE_ID)?.remove();
    delete root.dataset.pluginTheme;
    applied = null;
  }
  const theme = key ? registry.get(key) : undefined;
  if (!theme) return;
  for (const [name, value] of Object.entries(theme.tokens)) root.style.setProperty(name, value);
  if (theme.css) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = theme.css;
    document.head.appendChild(style);
  }
  root.dataset.pluginTheme = theme.key;
  applied = { key: theme.key, tokens: Object.keys(theme.tokens) };
}
