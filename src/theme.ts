/// Temas do app. Cada tema é uma paleta completa (cores, fonte, tamanho e formato dos componentes)
/// que `applyTheme` escreve como variáveis CSS inline no <html>. O CSS base (src/styles/themes.css)
/// só traz o padrão claro para antes do JavaScript; o resto sai daqui.

export type FontId = "inter" | "segoe" | "calibri" | "arial" | "verdana" | "georgia" | "palatino" | "consolas" | "cascadia";
export type ShapeId = "square" | "soft" | "round" | "bubbly" | "pill" | "leaf" | "diagonal" | "top" | "bubble" | "wave";
export type TextSizeId = "small" | "medium" | "large";

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
  /** Fundo do terminal embutido. */
  terminal: string;
  font: FontId;
  textSize: TextSizeId;
  /** Formato geral dos componentes. */
  shape: ShapeId;
  /** Formato só do balão do usuário. Nulo = igual ao geral. */
  bubbleShape: ShapeId | null;
  /** Formato só do composer. Nulo = igual ao geral. */
  composerShape: ShapeId | null;
  /** Formato só dos botões. Nulo = igual ao geral. */
  buttonShape: ShapeId | null;
  /** Formato só dos chips de ferramenta. Nulo = igual ao geral. */
  chipShape: ShapeId | null;
  /** Formato só dos itens da barra lateral. Nulo = igual ao geral. */
  itemShape: ShapeId | null;
  /** Formato só dos blocos de código. Nulo = igual ao geral. */
  codeShape: ShapeId | null;
  /** Vidro translúcido nos painéis (Luna). Desligado = superfícies planas. */
  glass: boolean;
}

export type ThemeId = "luna" | "claude" | "codex" | "terminal" | "pixel" | "custom";

export interface ThemeInfo {
  id: ThemeId;
  label: string;
  description: string;
  palette: ThemePalette;
}

/// Base de todo tema: os campos que quase nunca mudam, para cada tema só dizer o que é diferente.
const BASE: Omit<ThemePalette, "sidebar" | "chat" | "bubble" | "bubbleText" | "accent" | "text" | "terminal"> = {
  font: "inter",
  textSize: "medium",
  shape: "soft",
  bubbleShape: null,
  composerShape: null,
  buttonShape: null,
  chipShape: null,
  itemShape: null,
  codeShape: null,
  glass: false,
};

/// Temas de fábrica. O Luna é o padrão: o gatinho em grafite e âmbar, sem tons pastel.
const PRESETS: ThemeInfo[] = [
  {
    id: "luna",
    label: "Luna",
    description: "Grafite quente com destaque âmbar, como o gatinho.",
    palette: { ...BASE, sidebar: "#1a1a1c", chat: "#201e1c", bubble: "#3a3530", bubbleText: "#f3e9d8", accent: "#e8a33d", text: "#ece6dc", terminal: "#161513" },
  },
  {
    id: "claude",
    label: "Claude",
    description: "As cores do Claude desktop, no escuro, com o terracota.",
    palette: { ...BASE, sidebar: "#1f1e1d", chat: "#262624", bubble: "#3a3936", bubbleText: "#f0eee6", accent: "#d97757", text: "#f0eee6", terminal: "#1f1e1d" },
  },
  {
    id: "codex",
    label: "Codex",
    description: "Cinza-carvão, sem brilho, com verde-menta no destaque.",
    palette: { ...BASE, sidebar: "#171717", chat: "#212121", bubble: "#2f2f2f", bubbleText: "#ececec", accent: "#10a37f", text: "#ececec", terminal: "#0d0d0d" },
  },
  {
    id: "terminal",
    label: "Terminal",
    description: "Tela de fósforo verde, texto monoespaçado e cantos retos.",
    palette: { ...BASE, font: "consolas", shape: "square", sidebar: "#031005", chat: "#051407", bubble: "#0c2412", bubbleText: "#63ff8a", accent: "#4dff7a", text: "#4dff7a", terminal: "#020a04" },
  },
  {
    id: "pixel",
    label: "Pixel art",
    description: "Retrô de arcade: azul-noite, amarelo vivo e bordas duras.",
    palette: { ...BASE, font: "consolas", shape: "square", sidebar: "#16132b", chat: "#1e1a3a", bubble: "#3b2f6b", bubbleText: "#fff3b0", accent: "#ffd23f", text: "#f4f1de", terminal: "#100c22" },
  },
  {
    id: "custom",
    label: "Personalizado",
    description: "Suas cores, fonte, tamanho e formatos.",
    palette: { ...BASE, sidebar: "#111a24", chat: "#0f1620", bubble: "#223347", bubbleText: "#e2ecf7", accent: "#8cc4e8", text: "#e2ecf7", terminal: "#0a1018", glass: true },
  },
];

export const THEMES: ThemeInfo[] = PRESETS;

export const FONTS: Record<FontId, { label: string; stack: string }> = {
  inter: { label: "Inter", stack: '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif' },
  segoe: { label: "Segoe UI", stack: '"Segoe UI", system-ui, -apple-system, sans-serif' },
  calibri: { label: "Calibri", stack: 'Calibri, Carlito, "Segoe UI", sans-serif' },
  arial: { label: "Arial", stack: 'Arial, Helvetica, sans-serif' },
  verdana: { label: "Verdana", stack: 'Verdana, Geneva, sans-serif' },
  georgia: { label: "Georgia (serifa)", stack: 'Georgia, "Times New Roman", serif' },
  palatino: { label: "Palatino (serifa)", stack: '"Palatino Linotype", Palatino, "Book Antiqua", serif' },
  consolas: { label: "Consolas (mono)", stack: 'Consolas, "Cascadia Mono", ui-monospace, monospace' },
  cascadia: { label: "Cascadia Code (mono)", stack: '"Cascadia Code", "Cascadia Mono", Consolas, monospace' },
};

export const SHAPES: Record<ShapeId, { label: string; sm: string; md: string; lg: string; xl: string; pill: string }> = {
  square: { label: "Quadrado", sm: "2px", md: "3px", lg: "4px", xl: "6px", pill: "4px" },
  soft: { label: "Suave", sm: "6px", md: "8px", lg: "12px", xl: "16px", pill: "999px" },
  round: { label: "Redondo", sm: "10px", md: "14px", lg: "18px", xl: "24px", pill: "999px" },
  bubbly: { label: "Bem redondo", sm: "14px", md: "18px", lg: "22px", xl: "28px", pill: "999px" },
  pill: { label: "Pílula", sm: "999px", md: "999px", lg: "28px", xl: "28px", pill: "999px" },
  leaf: { label: "Folha", sm: "0 8px", md: "0 12px", lg: "0 18px", xl: "0 24px", pill: "999px" },
  diagonal: { label: "Diagonal", sm: "8px 0", md: "12px 0", lg: "18px 0", xl: "24px 0", pill: "999px" },
  top: { label: "Aba", sm: "10px 10px 2px 2px", md: "14px 14px 3px 3px", lg: "18px 18px 4px 4px", xl: "24px 24px 6px 6px", pill: "999px" },
  bubble: { label: "Bolha de conversa", sm: "8px 8px 8px 2px", md: "12px 12px 12px 3px", lg: "16px 16px 16px 4px", xl: "20px 20px 20px 4px", pill: "999px" },
  wave: { label: "Ondulado", sm: "4px 14px", md: "6px 18px", lg: "8px 22px", xl: "10px 26px", pill: "999px" },
};

export const TEXT_SIZES: Record<TextSizeId, { label: string; scale: number }> = {
  small: { label: "Pequeno", scale: 0.92 },
  medium: { label: "Médio", scale: 1 },
  large: { label: "Grande", scale: 1.12 },
};

/// Escala de tipo do tokens.css, em px. O tamanho escolhido multiplica todos.
const TYPE_SCALE_PX: Record<string, number> = {
  "--text-xs": 11,
  "--text-sm": 12,
  "--text-base": 13,
  "--text-md": 14,
  "--text-lg": 16,
  "--text-xl": 20,
  "--text-2xl": 28,
};

export const THEME_KEY = "luna.theme";
export const CUSTOM_KEY = "luna.customTheme";
/** Disparado ao trocar de tema, para quem desenha cores fora do CSS (o terminal). */
export const THEME_EVENT = "luna:theme";

/** Padrão de quem ainda não escolheu. Temas removidos (Noite, Musgo etc.) caem aqui. */
export const DEFAULT_THEME: ThemeId = "luna";
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

const shapeOrNull = (value: unknown): ShapeId | null =>
  Object.keys(SHAPES).includes(value as string) ? (value as ShapeId) : null;

/// Lê a paleta salva. Paletas antigas ganham os campos novos com valores que mantêm o visual de antes.
export function readPalette(value: unknown): ThemePalette | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (!COLOR_KEYS.every((k) => typeof p[k] === "string" && HEX.test(p[k] as string))) return null;
  const sidebar = p.sidebar as string;
  const chat = p.chat as string;
  const bubble = p.bubble as string;
  const accent = p.accent as string;
  const hexOr = (value: unknown, fallback: string) => (typeof value === "string" && HEX.test(value) ? value : fallback);
  return {
    sidebar,
    chat,
    bubble,
    accent,
    bubbleText: hexOr(p.bubbleText, readableInk(bubble)),
    text: hexOr(p.text, readableInk(chat)),
    terminal: hexOr(p.terminal, sidebar),
    font: Object.keys(FONTS).includes(p.font as string) ? (p.font as FontId) : BASE.font,
    textSize: Object.keys(TEXT_SIZES).includes(p.textSize as string) ? (p.textSize as TextSizeId) : BASE.textSize,
    shape: Object.keys(SHAPES).includes(p.shape as string) ? (p.shape as ShapeId) : BASE.shape,
    bubbleShape: shapeOrNull(p.bubbleShape),
    composerShape: shapeOrNull(p.composerShape),
    buttonShape: shapeOrNull(p.buttonShape),
    chipShape: shapeOrNull(p.chipShape),
    itemShape: shapeOrNull(p.itemShape),
    codeShape: shapeOrNull(p.codeShape),
    glass: typeof p.glass === "boolean" ? p.glass : BASE.glass,
  };
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
  const scale = TEXT_SIZES[p.textSize].scale;
  const typeTokens = Object.fromEntries(
    Object.entries(TYPE_SCALE_PX).map(([name, px]) => [name, `${Math.round(px * scale * 10) / 10}px`]),
  );
  return {
    ...typeTokens,
    "--bg": p.chat,
    "--bg-sidebar": p.sidebar,
    "--surface": mix(4, p.chat),
    "--glass": p.glass ? `color-mix(in srgb, ${p.chat} 72%, transparent)` : "var(--surface)",
    "--glass-border": p.glass ? `color-mix(in srgb, ${p.text} 12%, transparent)` : "var(--border)",
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
    "--bubble-radius": SHAPES[p.bubbleShape ?? p.shape].lg,
    "--composer-radius": SHAPES[p.composerShape ?? p.shape].xl,
    "--button-radius": SHAPES[p.buttonShape ?? p.shape].md,
    "--chip-radius": SHAPES[p.chipShape ?? p.shape].pill,
    "--item-radius": SHAPES[p.itemShape ?? p.shape].md,
    "--code-radius": SHAPES[p.codeShape ?? p.shape].md,
    "--success": dark ? "#7fd6a4" : "#2e7d4f",
    "--warning": dark ? "#f2c46d" : "#9a6a10",
    "--error": dark ? "#ff8a9a" : "#b3261e",
    "--diff-add": dark ? "#7fd6a4" : "#2e7d4f",
    "--diff-del": dark ? "#ff8a9a" : "#b3261e",
    "--terminal-bg": p.terminal,
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
