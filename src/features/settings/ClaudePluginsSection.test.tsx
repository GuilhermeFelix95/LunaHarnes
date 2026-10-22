import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api";
import { ClaudePluginsSection } from "./ClaudePluginsSection";

vi.mock("../../api", () => ({
  claudeCliVersionOk: vi.fn(async () => true),
  claudePluginsCatalog: vi.fn(),
  claudePluginDetails: vi.fn(async () => "Adiciona uma auditoria de APIs. Custo: ~240 tok por sessão."),
  claudePluginInstall: vi.fn(async () => {}),
  claudePluginUninstall: vi.fn(async () => {}),
  claudePluginSetEnabled: vi.fn(async () => {}),
  claudePluginUpdate: vi.fn(async () => {}),
  claudeMarketplacesList: vi.fn(async () => []),
  claudeMarketplaceAdd: vi.fn(async () => {}),
  claudeMarketplaceRemove: vi.fn(async () => {}),
}));

const INSTALADO = { id: "feature-dev@claude-plugins-official", version: "1.0.0", scope: "user", enabled: true };

function catalogo(extra: { pluginId: string; name: string; description: string }[] = []) {
  return {
    installed: [INSTALADO],
    available: [{ pluginId: "42crunch@claude-plugins-official", name: "42crunch", description: "Auditoria de APIs" }, ...extra],
  };
}

async function abrir() {
  render(<ClaudePluginsSection />);
  await screen.findByText("feature-dev@claude-plugins-official");
}

describe("ClaudePluginsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.claudeCliVersionOk).mockResolvedValue(true);
    vi.mocked(api.claudePluginsCatalog).mockResolvedValue(catalogo());
    vi.mocked(api.claudeMarketplacesList).mockResolvedValue([]);
  });

  it("lista os plugins instalados com o escopo e o estado de ativo", async () => {
    await abrir();

    const linha = screen.getByText("feature-dev@claude-plugins-official").closest("li") as HTMLElement;
    expect(within(linha).getByText(/usuário/i)).toBeTruthy();
    expect(within(linha).getByRole("button", { name: "Desativar" })).toBeTruthy();
  });

  it("desativar um plugin pede a CLI e reflete o novo estado", async () => {
    await abrir();

    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));

    await waitFor(() => expect(api.claudePluginSetEnabled).toHaveBeenCalledWith("feature-dev@claude-plugins-official", false));
  });

  it("avisa quando a CLI instalada é antiga para gerir plugins", async () => {
    vi.mocked(api.claudeCliVersionOk).mockResolvedValue(false);

    render(<ClaudePluginsSection />);

    expect(await screen.findByText(/CLI do Claude Code instalada é antiga/)).toBeTruthy();
  });

  it("instalar mostra o que o plugin adiciona e não instala antes da confirmação", async () => {
    await abrir();

    fireEvent.click(screen.getByRole("button", { name: "Revisar 42crunch" }));
    expect(await screen.findByText(/Custo: ~240 tok/)).toBeTruthy();
    expect(api.claudePluginInstall).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar instalação" }));

    await waitFor(() => expect(api.claudePluginInstall).toHaveBeenCalledWith("42crunch@claude-plugins-official", true));
  });

  it("cancelar a revisão não instala nada", async () => {
    await abrir();

    fireEvent.click(screen.getByRole("button", { name: "Revisar 42crunch" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(api.claudePluginInstall).not.toHaveBeenCalled();
  });

  it("remover pede confirmação antes de chamar a CLI", async () => {
    await abrir();

    fireEvent.click(screen.getByRole("button", { name: "Remover feature-dev@claude-plugins-official" }));
    expect(api.claudePluginUninstall).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: "Confirmar remoção" }));

    await waitFor(() => expect(api.claudePluginUninstall).toHaveBeenCalledWith("feature-dev@claude-plugins-official", true));
  });

  it("a lista disponível mostra no máximo 50 itens e a busca filtra", async () => {
    const muitos = Array.from({ length: 120 }, (_, i) => ({
      pluginId: `plugin-${i}@claude-plugins-official`,
      name: `plugin-${i}`,
      description: i === 99 ? "ferramenta rara" : "outro",
    }));
    vi.mocked(api.claudePluginsCatalog).mockResolvedValue(catalogo(muitos));
    await abrir();

    expect(screen.getAllByRole("button", { name: /^Revisar / }).length).toBeLessThanOrEqual(50);

    fireEvent.change(screen.getByLabelText("Buscar plugins"), { target: { value: "rara" } });

    expect(screen.getAllByRole("button", { name: /^Revisar / })).toHaveLength(1);
    expect(screen.getByText("plugin-99")).toBeTruthy();
  });

  it("origem de marketplace fora de dono/repo ou https não chama a CLI", async () => {
    await abrir();

    fireEvent.change(screen.getByLabelText("Origem do marketplace"), { target: { value: "C:\\pasta" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar marketplace" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(api.claudeMarketplaceAdd).not.toHaveBeenCalled();
  });

  it("adicionar um marketplace do GitHub chama a CLI e recarrega a lista", async () => {
    await abrir();

    fireEvent.change(screen.getByLabelText("Origem do marketplace"), { target: { value: "anthropics/claude-code" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar marketplace" }));

    await waitFor(() => expect(api.claudeMarketplaceAdd).toHaveBeenCalledWith("anthropics/claude-code"));
    await waitFor(() => expect(api.claudePluginsCatalog).toHaveBeenCalledTimes(2));
  });

  it("uma falha da CLI aparece na tela com a mensagem dela", async () => {
    vi.mocked(api.claudePluginSetEnabled).mockRejectedValueOnce("não foi possível alterar o plugin: sem permissão");
    await abrir();

    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));

    expect((await screen.findByRole("alert")).textContent).toContain("sem permissão");
  });
});
