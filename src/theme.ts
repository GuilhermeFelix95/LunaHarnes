/// Temas do app. As cores ficam em src/styles/themes.css, num bloco `:root[data-theme="<id>"]` por tema.

export type ThemeId = "system" | "light" | "dark" | "luna" | "aurora" | "duna" | "grafite";

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
    preview: { bg: "linear-gradient(135deg, #faf9f5 50%, #262624 50%)", sidebar: "#f0eee6", bubble: "#3a3936", accent: "#b25737" },
  },
  {
    id: "light",
    label: "Claro",
    description: "Neutro e quente, para o dia.",
    preview: { bg: "#faf9f5", sidebar: "#f0eee6", bubble: "#f0eee6", accent: "#b25737" },
  },
  {
    id: "dark",
    label: "Escuro",
    description: "Neutro e quente, para a noite.",
    preview: { bg: "#262624", sidebar: "#1f1e1d", bubble: "#3a3936", accent: "#d97757" },
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

export function applyTheme(id: ThemeId, root: HTMLElement = document.documentElement) {
  if (id === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", id);
  window.dispatchEvent(new Event(THEME_EVENT));
}
