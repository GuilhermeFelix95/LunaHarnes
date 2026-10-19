import { beforeEach, describe, expect, it } from "vitest";
import { applyPluginTheme, listPluginThemes, loadPluginThemeKey, savePluginThemeKey, setPluginThemes } from "./themeRegistry";

const verde = { id: "verde", name: "Verde", dark: true, tokens: { "--bg": "#9bbc0f" }, css: ".chat { color: red; }" };

beforeEach(() => {
  applyPluginTheme(null);
  setPluginThemes([]);
  localStorage.clear();
});

describe("temas de plugin", () => {
  it("aplica tokens e CSS do tema escolhido e tira tudo ao voltar", () => {
    setPluginThemes([{ ...verde, pluginId: "hello" }]);
    applyPluginTheme("plugin:hello/verde");

    expect(document.documentElement.style.getPropertyValue("--bg")).toBe("#9bbc0f");
    expect(document.getElementById("luna-plugin-theme")!.textContent).toContain(".chat");

    applyPluginTheme(null);
    expect(document.documentElement.style.getPropertyValue("--bg")).toBe("");
    expect(document.getElementById("luna-plugin-theme")).toBeNull();
  });

  it("carregar o mesmo plugin de novo não duplica o tema", () => {
    setPluginThemes([{ ...verde, pluginId: "hello" }]);
    setPluginThemes([{ ...verde, pluginId: "hello" }]);

    expect(listPluginThemes().map((t) => t.key)).toEqual(["plugin:hello/verde"]);
  });

  it("aplica a escolha salva quando o tema aparece depois do carregamento", () => {
    savePluginThemeKey("plugin:hello/verde");
    setPluginThemes([{ ...verde, pluginId: "hello" }]);

    expect(document.documentElement.style.getPropertyValue("--bg")).toBe("#9bbc0f");
    expect(loadPluginThemeKey()).toBe("plugin:hello/verde");
  });

  it("tira o tema aplicado quando o plugin deixa de existir", () => {
    setPluginThemes([{ ...verde, pluginId: "hello" }]);
    applyPluginTheme("plugin:hello/verde");
    setPluginThemes([]);

    expect(document.documentElement.style.getPropertyValue("--bg")).toBe("");
  });
});
