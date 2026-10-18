import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api";
import { PluginsSection } from "./PluginsSection";

vi.mock("../../api", () => ({
  addCatalogSource: vi.fn(async () => ({ name: "x", plugins: [] })),
  installCatalogPlugin: vi.fn(async () => {}),
  listCatalogSources: vi.fn(async () => []),
  listPlugins: vi.fn(async () => ({ plugins: [], errors: [] })),
  loadCatalog: vi.fn(async () => ({ name: "LunaHarness oficial", plugins: [] })),
  getPluginsState: vi.fn(async () => ({ disabled: [] })),
  OFFICIAL_SOURCE: "oficial",
  PLUGINS_CHANGED: "luna:plugins-changed",
  removeCatalogSource: vi.fn(async () => {}),
  setPluginEnabled: vi.fn(async () => ({ disabled: ["ask-mode"] })),
  uninstallPlugin: vi.fn(async () => {}),
}));

const ASK_INSTALLED = {
  id: "ask-mode",
  name: "Modo Conversar",
  version: "0.1.0",
  entry: "index.js",
  permissions: ["modes"],
};

const ASK_CATALOG = {
  name: "LunaHarness oficial",
  plugins: [
    {
      id: "ask-mode",
      name: "Modo Conversar",
      description: "Modo Conversar",
      author: "LunaHarness",
      version: "0.1.0",
      entry: "index.js",
      permissions: ["modes"],
      files: [],
    },
  ],
};

describe("PluginsSection", () => {
  beforeEach(() => {
    vi.mocked(api.listPlugins).mockResolvedValue({ plugins: [ASK_INSTALLED], errors: [] });
  });

  it("desliga um plugin instalado e avisa o chat", async () => {
    const announced = vi.fn();
    window.addEventListener("luna:plugins-changed", announced);
    render(<PluginsSection />);

    fireEvent.click(await screen.findByRole("button", { name: "Desligar" }));

    expect(api.setPluginEnabled).toHaveBeenCalledWith("ask-mode", false);
    expect(await screen.findByRole("button", { name: "Ligar" })).toBeTruthy();
    expect(announced).toHaveBeenCalled();
    window.removeEventListener("luna:plugins-changed", announced);
  });

  it("mostra as permissões antes de instalar e só instala depois da confirmação", async () => {
    vi.mocked(api.listPlugins).mockResolvedValue({ plugins: [], errors: [] });
    vi.mocked(api.loadCatalog).mockResolvedValue(ASK_CATALOG);
    render(<PluginsSection />);

    fireEvent.click(screen.getByRole("tab", { name: "Marketplace" }));
    fireEvent.click(await screen.findByRole("button", { name: "Instalar" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/oferece um modo de somente leitura/)).toBeTruthy();
    expect(api.installCatalogPlugin).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Instalar" }));

    expect(api.installCatalogPlugin).toHaveBeenCalledWith("oficial", "ask-mode");
  });
});
