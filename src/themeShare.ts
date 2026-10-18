import { readPalette, type ThemePalette } from "./theme";

/// Tema personalizado salvo com um nome. Fica só neste computador, até ser compartilhado.
export interface SavedTheme {
  name: string;
  palette: ThemePalette;
}

export const SAVED_THEMES_KEY = "luna.savedThemes";
/// Versão do código de compartilhamento. Um código de outra versão é recusado.
const SHARE_VERSION = 1;

function toSavedTheme(value: unknown): SavedTheme | null {
  if (!value || typeof value !== "object") return null;
  const { name, palette } = value as Record<string, unknown>;
  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanPalette = readPalette(palette);
  return cleanName && cleanPalette ? { name: cleanName, palette: cleanPalette } : null;
}

/// Temas salvos. Itens inválidos são descartados sem derrubar a lista.
export function loadSavedThemes(): SavedTheme[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(SAVED_THEMES_KEY) ?? "[]");
    if (!Array.isArray(list)) return [];
    return list.flatMap((item) => {
      const theme = toSavedTheme(item);
      return theme ? [theme] : [];
    });
  } catch {
    // Valor corrompido ou armazenamento indisponível: começa sem temas salvos.
    return [];
  }
}

export function saveSavedThemes(themes: SavedTheme[]) {
  try {
    localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify(themes));
  } catch {
    // Sem armazenamento, os temas valem só nesta sessão.
  }
}

/// Código de compartilhamento: um JSON com a versão, o nome e as cores. Quem recebe cola em "Importar".
export function shareCode(theme: SavedTheme): string {
  return JSON.stringify({ lunaTheme: SHARE_VERSION, name: theme.name, palette: theme.palette });
}

/// Lê um código de compartilhamento. Devolve null quando o texto não é um tema desta versão.
export function parseShareCode(text: string): SavedTheme | null {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || (value as Record<string, unknown>).lunaTheme !== SHARE_VERSION) return null;
    return toSavedTheme(value);
  } catch {
    return null;
  }
}
