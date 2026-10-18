import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPalette,
  applyTheme,
  CUSTOM_KEY,
  DEFAULT_PALETTE,
  loadCustomPalette,
  loadTheme,
  saveCustomPalette,
  saveTheme,
  THEME_KEY,
  THEMES,
  type ThemePalette,
} from "./theme";

const CUSTOM: ThemePalette = { ...DEFAULT_PALETTE, accent: "#40a0ff" };

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("style");
  });

  it("tem seis temas novos e o personalizado, e nenhum dos antigos", () => {
    expect(THEMES.map((t) => t.id)).toEqual(["noite", "musgo", "ametista", "papel", "oceano", "grafite", "custom"]);
  });

  it("nenhum tema usa laranja como destaque", () => {
    for (const t of THEMES) expect(t.palette.accent).not.toMatch(/^#(d9|b2|ae|f2)/i);
  });

  it("sem escolha salva, usa o Noite", () => {
    expect(loadTheme()).toBe("noite");
  });

  it("valor salvo desconhecido, como o Luna antigo, volta para o padrão", () => {
    localStorage.setItem(THEME_KEY, "luna");
    expect(loadTheme()).toBe("noite");
    localStorage.setItem(THEME_KEY, "<script>");
    expect(loadTheme()).toBe("noite");
  });

  it("salva e carrega o tema escolhido", () => {
    saveTheme("papel");
    expect(localStorage.getItem(THEME_KEY)).toBe("papel");
    expect(loadTheme()).toBe("papel");
  });

  it("aplica o tema no data-theme, nas variáveis e avisa quem desenha cores próprias", () => {
    const listener = vi.fn();
    window.addEventListener("luna:theme", listener);

    applyTheme("papel");
    const style = document.documentElement.style;
    expect(document.documentElement.getAttribute("data-theme")).toBe("papel");
    expect(style.getPropertyValue("--bg")).toBe("#fbf8f1");
    expect(style.getPropertyValue("--font-sans")).toContain("Georgia");
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("luna:theme", listener);
  });

  it("o formato escolhido vira os raios dos componentes", () => {
    applyPalette({ ...DEFAULT_PALETTE, shape: "square" });
    expect(document.documentElement.style.getPropertyValue("--radius-lg")).toBe("4px");

    applyPalette({ ...DEFAULT_PALETTE, shape: "bubbly" });
    expect(document.documentElement.style.getPropertyValue("--radius-lg")).toBe("22px");
  });

  it("a cor do texto do balão e a cor do texto valem para o tema", () => {
    applyPalette({ ...DEFAULT_PALETTE, bubbleText: "#ff0000", text: "#00ff00" });
    expect(document.documentElement.style.getPropertyValue("--user-fg")).toBe("#ff0000");
    expect(document.documentElement.style.getPropertyValue("--fg")).toBe("#00ff00");
  });

  it("personalizado sem cores salvas usa a paleta padrão", () => {
    expect(loadCustomPalette()).toEqual(DEFAULT_PALETTE);
  });

  it("paleta salva inválida volta para o padrão", () => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify({ sidebar: "azul", chat: "#000000", bubble: "#111111", accent: "#222222" }));
    expect(loadCustomPalette()).toEqual(DEFAULT_PALETTE);
  });

  it("paleta antiga, só com as quatro cores, ganha texto e fonte padrão", () => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify({ sidebar: "#101010", chat: "#202020", bubble: "#303030", accent: "#40a0ff" }));
    const loaded = loadCustomPalette();
    expect(loaded.chat).toBe("#202020");
    expect(loaded.font).toBe("inter");
    expect(loaded.shape).toBe("soft");
    expect(loaded.text).toMatch(/^#/);
  });

  it("alterar uma cor do personalizado troca na hora", () => {
    saveCustomPalette(CUSTOM);
    applyTheme("custom");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#40a0ff");

    applyPalette({ ...CUSTOM, accent: "#ff00aa" });
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#ff00aa");
  });

  it("trocar de tema troca todas as cores de uma vez", () => {
    applyTheme("musgo");
    applyTheme("grafite");
    expect(document.documentElement.style.getPropertyValue("--bg")).toBe("#1b1b1d");
  });
});
