import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_KEY } from "../../theme";
import { SettingsView } from "./SettingsView";

vi.mock("../../api", () => ({
  apiPresets: vi.fn(async () => []),
  apiProfileHasKey: vi.fn(async () => true),
  checkAuth: vi.fn(async () => true),
  deleteApiProfile: vi.fn(async () => {}),
  listApiProfiles: vi.fn(async () => []),
  PROFILES_CHANGED: "luna:profiles-changed",
  saveApiProfile: vi.fn(async () => ({})),
  setApiProfileKey: vi.fn(async () => {}),
  testApiProfile: vi.fn(async () => "ok"),
  listPlugins: vi.fn(async () => ({ plugins: [], errors: [] })),
  getPluginsState: vi.fn(async () => ({ disabled: [] })),
  listCatalogSources: vi.fn(async () => []),
  loadCatalog: vi.fn(async () => ({ name: "oficial", plugins: [] })),
  OFFICIAL_SOURCE: "oficial",
  PLUGINS_CHANGED: "luna:plugins-changed",
  addCatalogSource: vi.fn(async () => ({ name: "x", plugins: [] })),
  installCatalogPlugin: vi.fn(async () => {}),
  removeCatalogSource: vi.fn(async () => {}),
  setPluginEnabled: vi.fn(async () => ({ disabled: [] })),
  uninstallPlugin: vi.fn(async () => {}),
}));


describe("SettingsView", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("lista os seis temas, o Personalizado e marca o atual", () => {
    localStorage.setItem(THEME_KEY, "papel");
    render(<SettingsView onClose={() => {}} />);

    expect(screen.getAllByRole("radio")).toHaveLength(7);
    expect(screen.getByRole("radio", { name: /Personalizado/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Papel/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("o editor do Personalizado troca a fonte e o formato na hora", () => {
    localStorage.setItem(THEME_KEY, "custom");
    render(<SettingsView onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText("Fonte"), { target: { value: "consolas" } });
    fireEvent.change(screen.getByLabelText("Componentes"), { target: { value: "square" } });

    expect(document.documentElement.style.getPropertyValue("--font-sans")).toContain("Consolas");
    expect(document.documentElement.style.getPropertyValue("--radius-lg")).toBe("4px");
    expect(JSON.parse(localStorage.getItem("luna.customTheme") ?? "{}").font).toBe("consolas");
  });

  it("escolher um tema aplica na hora e salva", () => {
    render(<SettingsView onClose={() => {}} />);

    fireEvent.click(screen.getByRole("radio", { name: /Grafite/ }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("grafite");
    expect(localStorage.getItem(THEME_KEY)).toBe("grafite");
    expect(screen.getByRole("radio", { name: /Grafite/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("botão de voltar fecha a página", () => {
    const onClose = vi.fn();
    render(<SettingsView onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Voltar ao chat" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
