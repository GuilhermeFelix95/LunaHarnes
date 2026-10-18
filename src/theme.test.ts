import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, loadTheme, saveTheme, THEME_KEY, THEMES } from "./theme";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("tem sistema, claro, escuro e os quatro temas exclusivos", () => {
    expect(THEMES.map((t) => t.id)).toEqual(["system", "light", "dark", "luna", "aurora", "duna", "grafite"]);
  });

  it("sem escolha salva, usa o Luna, tema assinatura", () => {
    expect(loadTheme()).toBe("luna");
  });

  it("salva e carrega o tema escolhido", () => {
    saveTheme("aurora");
    expect(localStorage.getItem(THEME_KEY)).toBe("aurora");
    expect(loadTheme()).toBe("aurora");
  });

  it("valor salvo desconhecido volta para o padrão", () => {
    localStorage.setItem(THEME_KEY, "<script>");
    expect(loadTheme()).toBe("luna");
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
