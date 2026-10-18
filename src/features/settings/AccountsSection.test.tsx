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

import { installCli, openLogin } from "../../api";

describe("Contas: Baixar e conectar", () => {
  beforeEach(() => {
    vi.mocked(installCli).mockClear();
    vi.mocked(openLogin).mockClear();
  });

  it("mostra um botão por CLI, com o caminho da que já está instalada", async () => {
    render(<AccountsSection />);

    expect(await screen.findByText("CLI em C:\claude.exe")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Baixar e conectar" })).toHaveLength(2);
  });

  it("CLI que falta: instala primeiro e depois abre o login", async () => {
    render(<AccountsSection />);
    await screen.findByText("CLI em C:\claude.exe");

    fireEvent.click(screen.getAllByRole("button", { name: "Baixar e conectar" })[1]);

    await waitFor(() => expect(openLogin).toHaveBeenCalledWith("codex"));
    expect(installCli).toHaveBeenCalledWith("codex");
    expect(vi.mocked(installCli).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(openLogin).mock.invocationCallOrder[0]);
  });

  it("CLI já instalada: só abre o login, sem instalar de novo", async () => {
    render(<AccountsSection />);
    await screen.findByText("CLI em C:\claude.exe");

    fireEvent.click(screen.getAllByRole("button", { name: "Baixar e conectar" })[0]);

    await waitFor(() => expect(openLogin).toHaveBeenCalledWith("claude"));
    expect(installCli).not.toHaveBeenCalled();
  });

  it("falha na instalação aparece na conta, sem abrir o login", async () => {
    vi.mocked(installCli).mockRejectedValueOnce("o instalador do Codex falhou: sem rede");
    render(<AccountsSection />);
    await screen.findByText("CLI em C:\claude.exe");

    fireEvent.click(screen.getAllByRole("button", { name: "Baixar e conectar" })[1]);

    expect((await screen.findByRole("alert")).textContent).toContain("o instalador do Codex falhou: sem rede");
    expect(openLogin).not.toHaveBeenCalled();
  });
});
