import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserPasswords,
  importBrowserHtml,
  importBrowserPasswords,
  pickImportFile,
  playwrightInstall,
  playwrightStatus,
} from "../../api";
import { BrowserSection } from "./BrowserSection";

vi.mock("../../api", () => ({
  playwrightStatus: vi.fn(async () => false),
  playwrightInstall: vi.fn(async () => {}),
  pickImportFile: vi.fn(async (_kind: string) => ""),
  importBrowserHtml: vi.fn(async (_p: string, _t: string) => ({ bookmarks: 0, visits: 0 })),
  importBrowserPasswords: vi.fn(async (_p: string) => 0),
  browserPasswords: vi.fn(async () => []),
  listApiProfiles: vi.fn(async () => []),
  apiPresets: vi.fn(async () => []),
  listModels: vi.fn(async () => []),
}));

describe("Configurações > Navegador", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(playwrightStatus).mockResolvedValue(false);
  });

  it("guarda a escolha do Playwright para as próximas execuções", async () => {
    render(<BrowserSection />);

    fireEvent.click(screen.getByRole("radio", { name: "Playwright" }));

    expect(localStorage.getItem("luna.agentBrowser")).toBe("playwright");
  });

  it("com Playwright escolhido e sem Chromium, oferece instalar e pede confirmação antes", async () => {
    render(<BrowserSection />);
    fireEvent.click(screen.getByRole("radio", { name: "Playwright" }));

    fireEvent.click(await screen.findByRole("button", { name: "Instalar o Chromium" }));

    expect(playwrightInstall).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Instalar" }));
    await waitFor(() => expect(playwrightInstall).toHaveBeenCalledTimes(1));
  });

  it("com o embutido escolhido, não mostra instalação", async () => {
    render(<BrowserSection />);
    await waitFor(() => expect(playwrightStatus).toHaveBeenCalled());

    expect(screen.queryByRole("button", { name: "Instalar o Chromium" })).toBeNull();
  });
});


describe("Configurações > Navegador > busca e importação", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(playwrightStatus).mockResolvedValue(false);
    vi.mocked(pickImportFile).mockResolvedValue("C:\\do-navegador.html");
    vi.mocked(importBrowserHtml).mockReset();
  });

  function setup() {
    return render(<BrowserSection />);
  }

  it("os quatro motores aparecem e o Google vem marcado quando nada foi escolhido", () => {
    setup();

    const choices = screen.getAllByRole("radio", { name: /Google|DuckDuckGo|Bing|Brave/ }).map((radio) => (radio as HTMLInputElement).checked);
    expect(choices.filter((c) => c)).toEqual([true]);
    expect(screen.getByRole("radio", { name: "Google" }).getAttribute("checked")).not.toBeNull();
  });

  it("escolher o DuckDuckGo guarda para as próximas sessões", () => {
    setup();

    fireEvent.click(screen.getByRole("radio", { name: /DuckDuckGo/ }));

    expect(localStorage.getItem("luna.searchEngine")).toBe("duckduckgo");
  });

  it("escolher o Bing também guarda", () => {
    setup();

    fireEvent.click(screen.getByRole("radio", { name: /^Bing$/ }));

    expect(localStorage.getItem("luna.searchEngine")).toBe("bing");
  });

  it("importar favoritos lê o HTML escolhido e mostra quantos entraram", async () => {
    vi.mocked(importBrowserHtml).mockResolvedValue({ bookmarks: 3, visits: 0 });

    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Importar favoritos" }));

    expect(pickImportFile).toHaveBeenCalledWith("html");
    await waitFor(() => expect(importBrowserHtml).toHaveBeenCalledWith("C:\\do-navegador.html", "bookmarks"));
    expect(await screen.findByText(/Entraram 3 favoritos/)).toBeTruthy();
  });

  it("importar histórico guarda as visitas no histórico do app", async () => {
    vi.mocked(importBrowserHtml).mockResolvedValue({ bookmarks: 0, visits: 5 });

    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Importar histórico" }));

    await waitFor(() => expect(importBrowserHtml).toHaveBeenCalledWith("C:\\do-navegador.html", "history"));
    expect(await screen.findByText(/Entraram 5 páginas no histórico/)).toBeTruthy();
  });

  it("importar senhas lê o CSV e a lista abre com login e botão de copiar", async () => {
    vi.mocked(pickImportFile).mockResolvedValue("C:\\senhas.csv");
    vi.mocked(importBrowserPasswords).mockResolvedValue(2);
    vi.mocked(browserPasswords).mockResolvedValue([
      { url: "https://github.com/login", login: "ana", password: "segredo" },
    ]);

    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Importar senhas" }));

    await waitFor(() => expect(importBrowserPasswords).toHaveBeenCalledWith("C:\\senhas.csv"));
    fireEvent.click(await screen.findByRole("button", { name: "Ver senhas salvas" }));

    expect(await screen.findByText(/github\.com/)).toBeTruthy();
    expect(await screen.findByText(/ana/)).toBeTruthy();
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    fireEvent.click(screen.getByRole("button", { name: /Copiar senha de ana/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("segredo"));
  });

  it("a seção organiza o conteúdo em cartões e as escolhas viram fichas", () => {
    const { container } = render(<BrowserSection />);

    // Quatro cartões sempre visíveis: navegador do agente, IA do modo navegador, busca e importação (o cofre só aparece aberto).
    expect(container.querySelectorAll(".settings__card").length).toBe(4);
    // Seis fichas de escolha: navegador do agente (2) e motor de busca (4), todas com o círculo fora do olhar.
    expect(container.querySelectorAll(".settings__chip").length).toBe(6);
    expect(container.querySelectorAll(".settings__chip input[type=radio]").length).toBe(6);
  });
});
