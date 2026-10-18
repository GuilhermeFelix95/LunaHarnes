import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PALETTE } from "./theme";
import { loadSavedThemes, parseShareCode, saveSavedThemes, SAVED_THEMES_KEY, shareCode, type SavedTheme } from "./themeShare";

const theme: SavedTheme = { name: "Meu mar", palette: { ...DEFAULT_PALETTE, accent: "#2a9d8f" } };

describe("temas salvos", () => {
  afterEach(() => localStorage.removeItem(SAVED_THEMES_KEY));

  it("guarda e lê os temas salvos", () => {
    saveSavedThemes([theme]);

    expect(loadSavedThemes()).toEqual([theme]);
  });

  it("descarta item inválido sem perder os outros", () => {
    localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify([{ name: "quebrado", palette: { accent: "vermelho" } }, theme]));

    expect(loadSavedThemes()).toEqual([theme]);
  });

  it("valor corrompido vira lista vazia", () => {
    localStorage.setItem(SAVED_THEMES_KEY, "{não é json");

    expect(loadSavedThemes()).toEqual([]);
  });
});

describe("código de compartilhamento", () => {
  it("o que sai de shareCode volta igual em parseShareCode", () => {
    expect(parseShareCode(shareCode(theme))).toEqual(theme);
  });

  it("recusa texto que não é tema, de outra versão ou com cor inválida", () => {
    expect(parseShareCode("oi")).toBeNull();
    expect(parseShareCode(JSON.stringify({ lunaTheme: 2, name: "x", palette: DEFAULT_PALETTE }))).toBeNull();
    expect(parseShareCode(JSON.stringify({ lunaTheme: 1, name: "x", palette: { accent: "azul" } }))).toBeNull();
  });

  it("recusa nome vazio", () => {
    expect(parseShareCode(JSON.stringify({ lunaTheme: 1, name: "  ", palette: DEFAULT_PALETTE }))).toBeNull();
  });
});
