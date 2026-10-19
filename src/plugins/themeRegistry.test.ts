import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPluginAsset } from "../api";
import { applyPluginTheme, getThemeMedia, listPluginThemes, loadPluginThemeKey, savePluginThemeKey, setPluginThemes } from "./themeRegistry";

vi.mock("../api", () => ({
  readPluginAsset: vi.fn(async () => ({ mime: "image/png", data: "UE5H" })),
}));

const verde = { id: "verde", name: "Verde", dark: true, tokens: { "--bg": "#9bbc0f" }, css: ".chat { color: red; }" };

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:teste");
  URL.revokeObjectURL = vi.fn();
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

  it("troca asset(assets/...) por uma URL blob do arquivo do plugin", async () => {
    setPluginThemes([{ ...verde, tokens: { "--bg": "#9bbc0f", "--app-bg-image": "asset(assets/bg.png)" }, pluginId: "hello" }]);
    applyPluginTheme("plugin:hello/verde");

    await vi.waitFor(() => expect(document.documentElement.style.getPropertyValue("--app-bg-image")).toBe('url("blob:teste")'));
    expect(readPluginAsset).toHaveBeenCalledWith("hello", "assets/bg.png");
    expect(document.documentElement.style.getPropertyValue("--bg")).toBe("#9bbc0f");
  });

  it("expõe o mascote e o som de resposta do tema escolhido, e limpa ao voltar", async () => {
    setPluginThemes([{ ...verde, pluginId: "hello", mascot: "asset(assets/luna.png)", sounds: { reply: "asset(assets/ding.ogg)" } }]);
    applyPluginTheme("plugin:hello/verde");

    await vi.waitFor(() => expect(getThemeMedia().mascot).toBe("blob:teste"));
    expect(getThemeMedia().reply).toBe("blob:teste");
    expect(readPluginAsset).toHaveBeenCalledWith("hello", "assets/ding.ogg");

    applyPluginTheme(null);
    expect(getThemeMedia()).toEqual({});
  });
});

describe("temas de plugin com assets", () => {
  it("aplicar o mesmo tema duas vezes durante o download deixa um só estilo e revoga os blobs da primeira", async () => {
    setPluginThemes([{ ...verde, css: ".chat { background: asset(assets/bg.png); }", pluginId: "hello" }]);

    applyPluginTheme("plugin:hello/verde");
    applyPluginTheme("plugin:hello/verde");
    await vi.waitFor(() => expect(readPluginAsset).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelectorAll("#luna-plugin-theme")).toHaveLength(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:teste");
    applyPluginTheme(null);
  });
});
