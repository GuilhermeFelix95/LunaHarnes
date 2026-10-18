/// Temas do app. Cada tema é uma paleta completa (cores, fonte e formato dos componentes) que
/// `applyTheme` escreve como variáveis CSS inline no <html>. O CSS base (src/styles/themes.css)
/// só traz o padrão claro para antes do JavaScript; o resto sai daqui.

export type FontId = "inter" | "segoe" | "georgia" | "consolas";
export type ShapeId = "square" | "soft" | "round" | "bubbly";

/// Tudo o que um tema define. O Personalizado é uma paleta salva pelo usuário.
export interface ThemePalette {
  /** Barra lateral. */
  sidebar: string;
  /** Área da conversa. */
  chat: string;
  /** Balão da mensagem do usuário. */
  bubble: string;
  /** Texto dentro do balão do usuário. */
  bubbleText: string;
  /** Destaque: botões, foco e itens ativos. */
  accent: string;
  /** Texto principal. */
  text: string;
  font: FontId;
  shape: ShapeId;
}

export type ThemeId = "noite" | "musgo" | "ametista" | "papel" | "oceano" | "grafite" | "custom";

export interface ThemeInfo {
  id: ThemeId;
  label: string;
  description: string;
  palette: ThemePalette;
}

const PRESETS: ThemeInfo[] = [
  {
    id: "noite",
    label: "Noite",
    description: "Azul-marinho profundo com destaque prateado.",
    palette: { sidebar: "#0b111b", chat: "#0f1622", bubble: "#1f2d40", bubbleText: "#e6eef8", accent: "#8cc4e8", text: "#e6eef8", font: "inter", shape: "soft" },
  },
  {
    id: "musgo",
    label: "Musgo",
    description: "Verde-floresta escuro, calmo para leituras longas.",
    palette: { sidebar: "#0c140f", chat: "#111a15", bubble: "#1f3026", bubbleText: "#e4f2e8", accent: "#9fd8a9", text: "#e4f2e8", font: "inter", shape: "soft" },
  },
  {
    id: "ametista",
    label: "Ametista",
    description: "Violeta noturno, com cantos mais redondos.",
    palette: { sidebar: "#0f0c17", chat: "#15121f", bubble: "#2b2342", bubbleText: "#efeaff", accent: "#b9a6ff", text: "#efeaff", font: "inter", shape: "round" },
  },
  {
    id: "papel",
    label: "Papel",
    description: "Claro e com serifa, para ler como em papel.",
    palette: { sidebar: "#f1ebdd", chat: "#fbf8f1", bubble: "#e7dfcb", bubbleText: "#2a2620", accent: "#1f7a72", text: "#2a2620", font: "georgia", shape: "soft" },
  },
  {
    id: "oceano",
    label: "Oceano",
    description: "Azul claro e limpo, com a fonte do Windows.",
    palette: { sidebar: "#e6eef6", chat: "#f6f9fc", bubble: "#d7e5f2", bubbleText: "#13263a", accent: "#2563a8", text: "#13263a", font: "segoe", shape: "soft" },
  },
  {
    id: "grafite",
    label: "Grafite",
    description: "Monocromático, com cantos retos.",
    palette: { sidebar: "#141416", chat: "#1b1b1d", bubble: "#2a2a2e", bubbleText: "#f0f0f0", accent: "#e4e4e4", text: "#f0f0f0", font: "inter", shape: "square" },
  },
  {
    id: "custom",
    label: "Personalizado",
    description: "Suas cores, sua fonte e o formato dos componentes.",
    palette: { sidebar: "#111a24", chat: "#0f1620", bubble: "#223347", bubbleText: "#e2ecf7", accent: "#8cc4e8", text: "#e2ecf7", font: "inter", shape: "soft" },
  },
];

export const THEMES: ThemeInfo[] = PRESETS;

export const FONTS: Record<FontId, { label: string; stack: string }> = {
  inter: { label: "Inter", stack: '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif' },
  segoe: { label: "Segoe UI", stack: '"Segoe UI", system-ui, -apple-system, sans-serif' },
  georgia: { label: "Georgia (serifa)", stack: 'Georgia, "Times New Roman", serif' },
  consolas: { label: "Consolas (mono)", stack: 'Consolas, "Cascadia Mono", ui-monospace, monospace' },
};

export const SHAPES: Record<ShapeId, { label: string; sm: string; md: string; lg: string; xl: string; pill: string }> = {
  square: { label: "Quadrado", sm: "2px", md: "3px", lg: "4px", xl: "6px", pill: "4px" },
  soft: { label: "Suave", sm: "6px", md: "8px", lg: "12px", xl: "16px", pill: "999px" },
  round: { label: "Redondo", sm: "10px", md: "14px", lg: "18px", xl: "24px", pill: "999px" },
  bubbly: { label: "Bem redondo", sm: "14px", md: "18px", lg: "22px", xl: "28px", pill: "999px" },
};

export const THEME_KEY = "luna.theme";
export const CUSTOM_KEY = "luna.customTheme";
/** Disparado ao trocar de tema, para quem desenha cores fora do CSS (o terminal). */
export const THEME_EVENT = "luna:theme";

/** Padrão de quem ainda não escolheu. O Luna saiu da lista: quem o tinha salvo cai aqui. */
export const DEFAULT_THEME: ThemeId = "noite";
export const DEFAULT_PALETTE: ThemePalette = PRESETS.find((t) => t.id === "custom")!.palette;

const HEX = /^#[0-9a-f]{6}$/i;
const COLOR_KEYS = ["sidebar", "chat", "bubble", "accent"] as const;

function isTheme(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

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

/// Lê a paleta salva. Paletas antigas (só as quatro cores) ganham texto e fonte padrão.
function readPalette(value: unknown): ThemePalette | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (!COLOR_KEYS.every((k) => typeof p[k] === "string" && HEX.test(p[k] as string))) return null;
  const sidebar = p.sidebar as string;
  const chat = p.chat as string;
  const bubble = p.bubble as string;
  const accent = p.accent as string;
  const bubbleText = typeof p.bubbleText === "string" && HEX.test(p.bubbleText) ? p.bubbleText : readableInk(bubble);
  const text = typeof p.text === "string" && HEX.test(p.text) ? p.text : readableInk(chat);
  const font = Object.keys(FONTS).includes(p.font as string) ? (p.font as FontId) : "inter";
  const shape = Object.keys(SHAPES).includes(p.shape as string) ? (p.shape as ShapeId) : "soft";
  return { sidebar, chat, bubble, bubbleText, accent, text, font, shape };
}

export function loadCustomPalette(): ThemePalette {
  try {
    const saved = readPalette(JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "null"));
    if (saved) return saved;
  } catch {
    // Valor corrompido ou armazenamento indisponível: usa o padrão.
  }
  return { ...DEFAULT_PALETTE };
}

export function saveCustomPalette(palette: ThemePalette) {
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

/// Todas as variáveis do tema, derivadas da paleta. Os tons de status mudam entre claro e escuro.
export function themeTokens(p: ThemePalette): Record<string, string> {
  const dark = luminance(p.chat) < 0.18;
  const mix = (amount: number, base: string) => `color-mix(in srgb, ${p.text} ${amount}%, ${base})`;
  const shape = SHAPES[p.shape];
  return {
    "--bg": p.chat,
    "--bg-sidebar": p.sidebar,
    "--surface": mix(4, p.chat),
    "--glass": "var(--surface)",
    "--glass-border": "var(--border)",
    "--fg": p.text,
    "--fg-muted": mix(72, p.chat),
    "--fg-subtle": mix(62, p.chat),
    "--border": mix(14, p.chat),
    "--border-strong": mix(24, p.chat),
    "--hover": mix(8, p.chat),
    "--code-bg": mix(6, p.sidebar),
    "--accent": p.accent,
    "--accent-fg": readableInk(p.accent),
    "--accent-soft": `color-mix(in srgb, ${p.accent} 16%, transparent)`,
    "--focus-ring": p.accent,
    "--glow": `color-mix(in srgb, ${p.accent} 18%, transparent)`,
    "--user-bubble": p.bubble,
    "--user-fg": p.bubbleText,
    "--success": dark ? "#7fd6a4" : "#2e7d4f",
    "--warning": dark ? "#f2c46d" : "#9a6a10",
    "--error": dark ? "#ff8a9a" : "#b3261e",
    "--diff-add": dark ? "#7fd6a4" : "#2e7d4f",
    "--diff-del": dark ? "#ff8a9a" : "#b3261e",
    "--terminal-bg": p.sidebar,
    "--terminal-fg": p.text,
    "--shadow": dark ? "0 10px 40px rgb(0 0 0 / 45%)" : "0 10px 30px rgb(0 0 0 / 10%)",
    "--font-sans": FONTS[p.font].stack,
    "--font-display": FONTS[p.font].stack,
    "--radius-sm": shape.sm,
    "--radius-md": shape.md,
    "--radius-lg": shape.lg,
    "--radius-xl": shape.xl,
    "--radius-pill": shape.pill,
    "color-scheme": dark ? "dark" : "light",
  };
}

/// Aplica uma paleta inteira. Chamado ao trocar de tema e a cada mudança no editor do Personalizado.
export function applyPalette(palette: ThemePalette, root: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(themeTokens(palette))) root.style.setProperty(name, value);
}

/// Paleta de um tema: a do próprio tema, ou a salva pelo usuário no Personalizado.
export function paletteOf(id: ThemeId): ThemePalette {
  if (id === "custom") return loadCustomPalette();
  return THEMES.find((t) => t.id === id)?.palette ?? DEFAULT_PALETTE;
}

export function applyTheme(id: ThemeId, root: HTMLElement = document.documentElement) {
  root.setAttribute("data-theme", id);
  applyPalette(paletteOf(id), root);
  window.dispatchEvent(new Event(THEME_EVENT));
}
