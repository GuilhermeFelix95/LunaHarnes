import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CliStatus } from "../../types";
import { SetupScreen } from "./SetupScreen";

const installCli = vi.fn();

vi.mock("../../api", () => ({
  installCli: (kind: string) => installCli(kind),
}));

const claudeInstalled: CliStatus = { provider: "claude", installed: true, path: "C:\\Users\\x\\.local\\bin\\claude.exe" };
const codexMissing: CliStatus = { provider: "codex", installed: false, path: null };

describe("SetupScreen", () => {
  beforeEach(() => {
    installCli.mockReset();
  });

  it("mostra onde a CLI já está e só oferece instalar a que falta", () => {
    render(<SetupScreen statuses={[claudeInstalled, codexMissing]} onSkip={vi.fn()} />);

    expect(screen.getByText(/Instalado em C:\\Users\\x\\.local\\bin\\claude.exe/)).toBeTruthy();
    expect(screen.getByText("Não encontrado")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Instalar" })).toHaveLength(1);
  });

  it("instalar a CLI que falta chama o instalador dela e atualiza a linha", async () => {
    installCli.mockResolvedValue({ provider: "codex", installed: true, path: "C:\\codex\\codex.exe" });
    render(<SetupScreen statuses={[claudeInstalled, codexMissing]} onSkip={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Instalar" }));

    await waitFor(() => expect(screen.getByText(/Instalado em C:\\codex\\codex.exe/)).toBeTruthy());
    expect(installCli).toHaveBeenCalledWith("codex");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeTruthy();
  });

  it("uma falha aparece na tela, sem apagar o que já estava instalado", async () => {
    installCli.mockRejectedValue("o instalador do Codex falhou: sem rede");
    render(<SetupScreen statuses={[claudeInstalled, codexMissing]} onSkip={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Instalar" }));

    expect((await screen.findByRole("alert")).textContent).toContain("sem rede");
    expect(screen.getByText(/Instalado em C:\\Users\\x\\.local\\bin\\claude.exe/)).toBeTruthy();
  });

  it("Pular fecha a tela sem instalar nada", () => {
    const onSkip = vi.fn();
    render(<SetupScreen statuses={[claudeInstalled, codexMissing]} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole("button", { name: "Pular por agora" }));

    expect(onSkip).toHaveBeenCalledOnce();
    expect(installCli).not.toHaveBeenCalled();
  });
});
