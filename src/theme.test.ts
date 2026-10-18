import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyCustomPalette,
  applyTheme,
  CUSTOM_KEY,
  DEFAULT_PALETTE,
  loadCustomPalette,
  loadTheme,
  saveCustomPalette,
  saveTheme,
  THEME_KEY,
  THEMES,
} from "./theme";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("style");
  });

  it("tem sistema, claro, escuro, os quatro temas exclusivos e o personalizado", () => {
    expect(THEMES.map((t) => t.id)).toEqual(["system", "light", "dark", "luna", "aurora", "duna", "grafite", "custom"]);
  });

  it("o destaque do claro e do escuro não é laranja", () => {
    const light = THEMES.find((t) => t.id === "light");
    const dark = THEMES.find((t) => t.id === "dark");
    expect(light?.preview.accent).toBe("#2a6f97");
    expect(dark?.preview.accent).toBe("#8cc4e8");
  });

  it("personalizado sem cores salvas usa a paleta padrão", () => {
    expect(loadCustomPalette()).toEqual(DEFAULT_PALETTE);
  });

  it("paleta salva inválida volta para o padrão", () => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify({ sidebar: "azul", chat: "#000000", bubble: "#111111", accent: "#222222" }));
    expect(loadCustomPalette()).toEqual(DEFAULT_PALETTE);
  });

  it("aplica as quatro cores do personalizado como variáveis no html", () => {
    saveCustomPalette({ sidebar: "#101010", chat: "#202020", bubble: "#303030", accent: "#40a0ff" });
    applyTheme("custom");

    const style = document.documentElement.style;
    expect(document.documentElement.getAttribute("data-theme")).toBe("custom");
    expect(style.getPropertyValue("--bg-sidebar")).toBe("#101010");
    expect(style.getPropertyValue("--bg")).toBe("#202020");
    expect(style.getPropertyValue("--user-bubble")).toBe("#303030");
    expect(style.getPropertyValue("--accent")).toBe("#40a0ff");
  });

  it("alterar uma cor do personalizado troca na hora, sem reabrir o tema", () => {
    applyTheme("custom");
    applyCustomPalette({ ...DEFAULT_PALETTE, accent: "#ff00aa" });
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#ff00aa");
  });

  it("escolher outro tema tira as cores do personalizado", () => {
    applyTheme("custom");
    applyTheme("luna");
    expect(document.documentElement.style.getPropertyValue("--bg")).toBe("");
  });

  it("sem escolha salva, usa o Escuro, o padrão do Claude desktop", () => {
    expect(loadTheme()).toBe("dark");
  });

  it("salva e carrega o tema escolhido", () => {
    saveTheme("aurora");
    expect(localStorage.getItem(THEME_KEY)).toBe("aurora");
    expect(loadTheme()).toBe("aurora");
  });

  it("valor salvo desconhecido volta para o padrão", () => {
    localStorage.setItem(THEME_KEY, "<script>");
    expect(loadTheme()).toBe("dark");
  });

  it("aplica o tema no atributo data-theme e avisa quem desenha cores próprias", () => {
    const listener = vi.fn();
    window.addEventListener("luna:theme", listener);

    applyTheme("luna");
    expect(document.documentElement.getAttribute("data-theme")).toBe("luna");

    applyTheme("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener("luna:theme", listener);
  });
});
