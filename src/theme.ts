/// Temas do app. As cores ficam em src/styles/themes.css, num bloco `:root[data-theme="<id>"]` por tema.
/// O Personalizado não tem bloco no CSS: suas quatro cores viram variáveis inline no <html>, na hora.

export type ThemeId = "system" | "light" | "dark" | "luna" | "aurora" | "duna" | "grafite" | "custom";

export interface ThemeInfo {
  id: ThemeId;
  label: string;
  description: string;
  /** Prévia no cartão: fundo, barra lateral, balão do usuário e destaque. */
  preview: { bg: string; sidebar: string; bubble: string; accent: string };
}

export const THEMES: ThemeInfo[] = [
  {
    id: "system",
    label: "Sistema",
    description: "Claro ou escuro, como o Windows estiver.",
    preview: { bg: "linear-gradient(135deg, #faf9f5 50%, #262624 50%)", sidebar: "#f0eee6", bubble: "#3a3936", accent: "#2a6f97" },
  },
  {
    id: "light",
    label: "Claro",
    description: "Neutro e limpo, para o dia.",
    preview: { bg: "#faf9f5", sidebar: "#f0eee6", bubble: "#f0eee6", accent: "#2a6f97" },
  },
  {
    id: "dark",
    label: "Escuro",
    description: "Neutro e limpo, para a noite.",
    preview: { bg: "#262624", sidebar: "#1f1e1d", bubble: "#3a3936", accent: "#8cc4e8" },
  },
  {
    id: "luna",
    label: "Luna",
    description: "Ardósia azulada com a luz da Terra.",
    preview: { bg: "#0f1620", sidebar: "#111a24", bubble: "#223347", accent: "#8cc4e8" },
  },
  {
    id: "aurora",
    label: "Aurora",
    description: "Verde-água e violeta da aurora boreal.",
    preview: { bg: "#0f1a1c", sidebar: "#0b1416", bubble: "#2a2445", accent: "#3ddc97" },
  },
  {
    id: "duna",
    label: "Duna",
    description: "Areia clara com terracota queimada.",
    preview: { bg: "#f6efe3", sidebar: "#ede3d1", bubble: "#e6d9c2", accent: "#ae5028" },
  },
  {
    id: "grafite",
    label: "Grafite",
    description: "Cinza de alto contraste com âmbar.",
    preview: { bg: "#1c1c1e", sidebar: "#151517", bubble: "#2c2c30", accent: "#f2a33a" },
  },
  {
    id: "custom",
    label: "Personalizado",
    description: "Suas quatro cores, aplicadas na hora.",
    preview: { bg: "#0f1620", sidebar: "#111a24", bubble: "#223347", accent: "#8cc4e8" },
  },
];

export const THEME_KEY = "luna.theme";
/** Disparado ao trocar de tema, para quem desenha cores fora do CSS (o terminal). */
export const THEME_EVENT = "luna:theme";

function isTheme(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

/** Padrão de quem ainda não escolheu: o Luna, tema assinatura. */
export const DEFAULT_THEME: ThemeId = "luna";

export function loadTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (isTheme(saved)) return saved;
  } catch {
    // Armazenamento indisponível: usa o padrão.
  }
  return DEFAULT_THEME;
}

export function saveTheme(id: ThemeId) {
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {
    // Sem armazenamento, o tema vale só nesta sessão.
  }
}

/// As quatro cores do tema Personalizado. Os demais tons saem delas (ver customTokens).
export interface CustomPalette {
  /** Barra lateral. */
  sidebar: string;
  /** Área da conversa. */
  chat: string;
  /** Balão da mensagem do usuário. */
  bubble: string;
  /** Destaque: botões, foco e itens ativos. */
  accent: string;
}

export const CUSTOM_KEY = "luna.customTheme";
const PALETTE_KEYS = ["sidebar", "chat", "bubble", "accent"] as const;
const HEX = /^#[0-9a-f]{6}$/i;
/** Ponto de partida: o Luna, com o destaque azul-Maré. */
export const DEFAULT_PALETTE: CustomPalette = { sidebar: "#111a24", chat: "#0f1620", bubble: "#223347", accent: "#8cc4e8" };

function isPalette(value: unknown): value is CustomPalette {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return PALETTE_KEYS.every((k) => typeof p[k] === "string" && HEX.test(p[k] as string));
}

export function loadCustomPalette(): CustomPalette {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "null");
    if (isPalette(saved)) return { ...saved };
  } catch {
    // Valor corrompido ou armazenamento indisponível: usa o padrão.
  }
  return { ...DEFAULT_PALETTE };
}

export function saveCustomPalette(palette: CustomPalette) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(palette));
  } catch {
    // Sem armazenamento, a cor vale só nesta sessão.
  }
}

const INK_DARK = "#1f1e1d";
const INK_LIGHT = "#f2f6fa";

/// Luminância relativa (WCAG) de uma cor #rrggbb.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/// Texto escuro ou claro, o que tiver mais contraste sobre o fundo.
function readableInk(bg: string): string {
  const l = luminance(bg);
  const withDark = (l + 0.05) / (luminance(INK_DARK) + 0.05);
  const withLight = (luminance(INK_LIGHT) + 0.05) / (l + 0.05);
  return withDark >= withLight ? INK_DARK : INK_LIGHT;
}

/// Todas as variáveis do Personalizado, derivadas das quatro cores.
export function customTokens(p: CustomPalette): Record<string, string> {
  const fg = readableInk(p.chat);
  return {
    "--bg": p.chat,
    "--bg-sidebar": p.sidebar,
    "--surface": `color-mix(in srgb, ${fg} 4%, ${p.chat})`,
    "--fg": fg,
    "--fg-muted": `color-mix(in srgb, ${fg} 72%, ${p.chat})`,
    "--fg-subtle": `color-mix(in srgb, ${fg} 62%, ${p.chat})`,
    "--border": `color-mix(in srgb, ${fg} 14%, ${p.chat})`,
    "--border-strong": `color-mix(in srgb, ${fg} 24%, ${p.chat})`,
    "--accent": p.accent,
    "--accent-fg": readableInk(p.accent),
    "--accent-soft": `color-mix(in srgb, ${p.accent} 16%, transparent)`,
    "--focus-ring": p.accent,
    "--user-bubble": p.bubble,
    "--code-bg": `color-mix(in srgb, ${fg} 6%, ${p.sidebar})`,
    "--hover": `color-mix(in srgb, ${fg} 8%, ${p.chat})`,
    "--glow": `color-mix(in srgb, ${p.accent} 18%, transparent)`,
    "--glass-border": `color-mix(in srgb, ${fg} 9%, transparent)`,
    "color-scheme": luminance(p.chat) < 0.18 ? "dark" : "light",
  };
}

/// Aplica (ou reaplica) as cores do Personalizado. Chamado a cada mudança no editor.
export function applyCustomPalette(palette: CustomPalette, root: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(customTokens(palette))) root.style.setProperty(name, value);
}

function clearCustomPalette(root: HTMLElement) {
  for (const name of Object.keys(customTokens(DEFAULT_PALETTE))) root.style.removeProperty(name);
}

export function applyTheme(id: ThemeId, root: HTMLElement = document.documentElement) {
  if (id === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", id);

  if (id === "custom") applyCustomPalette(loadCustomPalette(), root);
  else clearCustomPalette(root);

  window.dispatchEvent(new Event(THEME_EVENT));
}
