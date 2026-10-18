import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PALETTE, THEME_KEY } from "../../theme";
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
  getRules: vi.fn(async () => ""),
  importRules: vi.fn(async () => ""),
  saveRules: vi.fn(async () => []),
}));


describe("SettingsView", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("lista os 12 temas de fábrica, depois Seus temas com cartão de cada tema salvo e o botão Novo tema", () => {
    localStorage.setItem(THEME_KEY, "terminal");
    localStorage.setItem("luna.savedThemes", JSON.stringify([{ name: "Mar", palette: { ...DEFAULT_PALETTE, accent: "#2a9d8f" } }]));
    render(<SettingsView onClose={() => {}} />);

    expect(screen.getAllByRole("radio")).toHaveLength(13);
    const mine = screen.getByRole("radiogroup", { name: "Seus temas" });
    expect(mine.textContent).toContain("Mar");
    expect(mine.textContent).toContain("Novo tema");
    expect(screen.getByRole("radio", { name: /Terminal/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("Novo tema cria um cartão com preview e abre o editor com ele ativo", () => {
    localStorage.setItem(THEME_KEY, "luna");
    render(<SettingsView onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /Novo tema/ }));

    const saved = JSON.parse(localStorage.getItem("luna.savedThemes")!);
    expect(saved[0].name).toBe("Tema 1");
    expect(screen.getByRole("radio", { name: /Tema 1/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText("Fonte")).toBeTruthy();
  });

  it("Novo tema abre o editor só com Seus temas, e Voltar aos temas restaura a lista de fábrica", () => {
    localStorage.setItem(THEME_KEY, "luna");
    render(<SettingsView onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /Novo tema/ }));

    expect(screen.queryByRole("radio", { name: /Luna/ })).toBeNull();
    expect(screen.getByRole("radiogroup", { name: "Seus temas" }).textContent).toContain("Tema 1");

    fireEvent.click(screen.getByRole("button", { name: "Voltar aos temas" }));

    expect(screen.getAllByRole("radio")).toHaveLength(13);
    expect(screen.queryByRole("button", { name: "Voltar aos temas" })).toBeNull();
  });

  it("o editor do Personalizado troca a fonte e o formato na hora", () => {
    localStorage.setItem(THEME_KEY, "custom");
    render(<SettingsView onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText("Fonte"), { target: { value: "consolas" } });
    fireEvent.change(screen.getByLabelText("Geral"), { target: { value: "square" } });

    expect(document.documentElement.style.getPropertyValue("--font-sans")).toContain("Consolas");
    expect(document.documentElement.style.getPropertyValue("--radius-lg")).toBe("4px");
    expect(JSON.parse(localStorage.getItem("luna.customTheme") ?? "{}").font).toBe("consolas");
  });

  it("escolher um tema aplica na hora e salva", () => {
    render(<SettingsView onClose={() => {}} />);

    fireEvent.click(screen.getByRole("radio", { name: /Pixel art/ }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("pixel");
    expect(localStorage.getItem(THEME_KEY)).toBe("pixel");
    expect(screen.getByRole("radio", { name: /Pixel art/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("troca de seção pelo menu lateral e lembra a última aberta", () => {
    const { unmount } = render(<SettingsView onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Regras globais" }));
    expect(screen.getByRole("button", { name: "Regras globais" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { name: "Regras globais" })).toBeTruthy();
    unmount();

    render(<SettingsView onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Regras globais" }).getAttribute("aria-current")).toBe("page");
  });

  it("botão de voltar fecha a página", () => {
    const onClose = vi.fn();
    render(<SettingsView onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Voltar ao chat" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("remover um tema personalizado tira o cartão e a lista salva", () => {
    localStorage.setItem(THEME_KEY, "custom");
    localStorage.setItem("luna.savedThemes", JSON.stringify([{ name: "Mar", palette: { ...DEFAULT_PALETTE, accent: "#2a9d8f" } }]));
    render(<SettingsView onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Remover Mar" }));

    expect(screen.queryByRole("radio", { name: /^Mar / })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remover Mar" })).toBeNull();
    expect(JSON.parse(localStorage.getItem("luna.savedThemes")!)).toEqual([]);
  });
});
