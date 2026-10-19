import { readPluginAsset } from "../api";
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
let blobs: string[] = [];
/** Cada aplicação ganha um número. Download que termina depois de outra aplicação é descartado. */
let generation = 0;

/** Mídia do tema escolhido, já como URL blob: o mascote da Luna e o som de resposta. */
export interface ThemeMedia {
  mascot?: string;
  reply?: string;
}
let media: ThemeMedia = {};
const mediaListeners = new Set<() => void>();

export function getThemeMedia(): ThemeMedia {
  return media;
}

/** Avisa quando o mascote ou o som muda (a tela da Luna se atualiza sozinha). */
export function subscribeThemeMedia(listener: () => void): () => void {
  mediaListeners.add(listener);
  return () => {
    mediaListeners.delete(listener);
  };
}

function setMedia(next: ThemeMedia) {
  media = next;
  for (const listener of mediaListeners) listener();
}

/** Caminho dentro de `asset(assets/arquivo)`. */
function refPath(ref: string): string {
  return ref.replace(/^asset\(/, "").replace(/\)$/, "");
}

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

/** Referência a um arquivo do plugin dentro de um valor de token ou do CSS: `asset(assets/bg.png)`. */
const ASSET_REF = /asset\((assets\/[^)\s"']+)\)/g;

function assetPaths(theme: RegisteredPluginTheme): string[] {
  const texts = [...Object.values(theme.tokens), theme.css ?? "", theme.mascot ?? "", theme.sounds?.reply ?? ""];
  return [...new Set(texts.flatMap((text) => [...text.matchAll(ASSET_REF)].map((m) => m[1])))];
}

/** Baixa os assets do tema e devolve a URL blob de cada um. */
async function blobUrls(theme: RegisteredPluginTheme): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  for (const path of assetPaths(theme)) {
    const { mime, data } = await readPluginAsset(theme.pluginId, path);
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    urls.set(path, URL.createObjectURL(new Blob([bytes], { type: mime })));
  }
  return urls;
}

function substitute(text: string, urls: Map<string, string>): string {
  return text.replace(ASSET_REF, (_, path: string) => `url("${urls.get(path)}")`);
}

/** Aplica o tema de plugin de `key`, ou tira o atual com `null`. Chave desconhecida também tira. */
export function applyPluginTheme(key: string | null, root: HTMLElement = document.documentElement) {
  const current = ++generation;
  if (applied) {
    for (const token of applied.tokens) root.style.removeProperty(token);
    document.getElementById(STYLE_ID)?.remove();
    for (const url of blobs) URL.revokeObjectURL(url);
    blobs = [];
    setMedia({});
    delete root.dataset.pluginTheme;
    applied = null;
  }
  const theme = key ? registry.get(key) : undefined;
  if (!theme) return;
  applied = { key: theme.key, tokens: Object.keys(theme.tokens) };
  root.dataset.pluginTheme = theme.key;

  // Sem assets, tudo vai na hora. Com assets, espera o download; se a escolha mudar nesse meio-tempo, descarta.
  const paint = (urls: Map<string, string>) => {
    setMedia({
      mascot: theme.mascot ? urls.get(refPath(theme.mascot)) : undefined,
      reply: theme.sounds?.reply ? urls.get(refPath(theme.sounds.reply)) : undefined,
    });
    for (const [name, value] of Object.entries(theme.tokens)) root.style.setProperty(name, substitute(value, urls));
    if (theme.css) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = substitute(theme.css, urls);
      document.head.appendChild(style);
    }
  };
  if (assetPaths(theme).length === 0) {
    paint(new Map());
    return;
  }
  blobUrls(theme)
    .then((urls) => {
      if (current !== generation) {
        for (const url of urls.values()) URL.revokeObjectURL(url);
        return;
      }
      blobs = [...urls.values()];
      paint(urls);
    })
    .catch(() => {
      // Asset que não carregou: o tema segue sem ele.
    });
}
