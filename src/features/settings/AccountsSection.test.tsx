import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountsSection } from "./AccountsSection";

vi.mock("../../api", () => ({
  checkAuth: vi.fn(async () => false),
  cliStatus: vi.fn(async () => [
    { provider: "claude", installed: true, path: "C:\claude.exe" },
    { provider: "codex", installed: false, path: null },
  ]),
  installCli: vi.fn(async () => ({ provider: "codex", installed: true, path: "C:\codex.exe" })),
  openLogin: vi.fn(async () => {}),
}));

import { checkAuth, cliStatus, installCli, openLogin } from "../../api";

describe("Contas: estado de cada CLI", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.mocked(checkAuth).mockImplementation(async () => false);
    vi.mocked(installCli).mockClear();
    vi.mocked(openLogin).mockClear();
  });

  it("OpenCode sem CLI: sem botão de baixar, e a instrução de instalar pelo site oficial", async () => {
    vi.mocked(cliStatus).mockResolvedValueOnce([
      { provider: "claude", installed: true, path: "C:\claude.exe" },
      { provider: "codex", installed: true, path: "C:\codex.exe" },
      { provider: "opencode", installed: false, path: null },
    ]);
    render(<AccountsSection />);

    const card = (await screen.findByText(/Instale o OpenCode/)).closest("li") as HTMLElement;
    expect(card.querySelector("button")).toBeNull();
    expect(screen.queryByRole("button", { name: "Baixar e conectar" })).toBeNull();
  });

  it("instalada e logada: sem botão, mostra conectado", async () => {
    vi.mocked(checkAuth).mockImplementation(async (p) => p === "claude");
    render(<AccountsSection />);

    expect(await screen.findByText("conectado")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1); // só o de Codex, que falta
    expect(screen.queryByRole("button", { name: "Conectar" })).toBeNull();
  });

  it("instalada mas não logada: botão Conectar, sem baixar", async () => {
    render(<AccountsSection />);

    const button = await screen.findByRole("button", { name: "Conectar" });
    fireEvent.click(button);

    await waitFor(() => expect(openLogin).toHaveBeenCalledWith("claude"));
    expect(installCli).not.toHaveBeenCalled();
  });

  it("entrar de novo na mesma abertura usa o que já foi visto, sem checar o login outra vez", async () => {
    vi.mocked(checkAuth).mockImplementation(async (p) => p === "claude");
    const first = render(<AccountsSection />);
    expect(await screen.findByText("conectado")).toBeTruthy();
    first.unmount();

    vi.mocked(checkAuth).mockClear();
    render(<AccountsSection />);

    expect(screen.getByText("conectado")).toBeTruthy();
    expect(checkAuth).not.toHaveBeenCalled();
  });

  it("ao voltar para o app, confere só as CLIs que ainda não estão conectadas", async () => {
    vi.mocked(checkAuth).mockImplementation(async (p) => p === "claude");
    render(<AccountsSection />);
    await screen.findByText("conectado");

    vi.mocked(checkAuth).mockClear();
    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(checkAuth).toHaveBeenCalled());
    expect(vi.mocked(checkAuth).mock.calls.map(([p]) => p)).not.toContain("claude");
  });

  it("CLI que falta: Baixar e conectar instala primeiro e depois abre o login", async () => {
    render(<AccountsSection />);

    fireEvent.click(await screen.findByRole("button", { name: "Baixar e conectar" }));

    await waitFor(() => expect(openLogin).toHaveBeenCalledWith("codex"));
    expect(installCli).toHaveBeenCalledWith("codex");
    expect(vi.mocked(installCli).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(openLogin).mock.invocationCallOrder[0]);
  });

  it("falha na instalação aparece na conta, sem abrir o login", async () => {
    vi.mocked(installCli).mockRejectedValueOnce("o instalador do Codex falhou: sem rede");
    render(<AccountsSection />);

    fireEvent.click(await screen.findByRole("button", { name: "Baixar e conectar" }));

    expect((await screen.findByRole("alert")).textContent).toContain("o instalador do Codex falhou: sem rede");
    expect(openLogin).not.toHaveBeenCalled();
  });
});
