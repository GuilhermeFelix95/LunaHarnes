import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { applyPluginTheme, loadPluginThemeKey, setPluginThemes } from "../../plugins/themeRegistry";
import { PluginThemePicker } from "./PluginThemePicker";

const verde = { id: "verde", name: "Verde", dark: true, tokens: { "--bg": "#9bbc0f" }, css: "", pluginId: "hello" };

beforeEach(() => {
  applyPluginTheme(null);
  setPluginThemes([]);
  localStorage.clear();
});

describe("PluginThemePicker", () => {
  it("escolher um tema de plugin aplica e guarda a escolha", () => {
    setPluginThemes([verde]);
    render(<PluginThemePicker />);

    fireEvent.click(screen.getByLabelText("Verde · hello"));

    expect(loadPluginThemeKey()).toBe("plugin:hello/verde");
    expect(document.documentElement.style.getPropertyValue("--bg")).toBe("#9bbc0f");
  });

  it("a primeira opção volta ao padrão do app e tira o tema de plugin", () => {
    setPluginThemes([verde]);
    render(<PluginThemePicker />);
    fireEvent.click(screen.getByLabelText("Verde · hello"));

    fireEvent.click(screen.getAllByRole("radio")[0]);

    expect(loadPluginThemeKey()).toBeNull();
    expect(document.documentElement.style.getPropertyValue("--bg")).toBe("");
  });
});
