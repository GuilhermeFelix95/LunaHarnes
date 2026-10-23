import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cliUpdateRun } from "../../api";
import type { CliUpdateInfo } from "../../types";
import { CliUpdateNotice } from "./CliUpdateNotice";

vi.mock("../../api", () => ({
  cliUpdateRun: vi.fn(),
}));

const claude: CliUpdateInfo = {
  provider: "claude",
  installed: "2.1.305",
  latest: "2.1.309",
  updateAvailable: true,
  canUpdate: true,
  error: null,
};

describe("Aviso de atualização da CLI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra a versão atual e a versão nova", () => {
    render(<CliUpdateNotice infos={[claude]} onUpdated={vi.fn()} />);

    expect(screen.getByRole("status").textContent).toContain("2.1.305");
    expect(screen.getByRole("status").textContent).toContain("2.1.309");
  });

  it("pedir a atualização abre a confirmação, e cancelar não executa nada", () => {
    render(<CliUpdateNotice infos={[claude]} onUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(cliUpdateRun).not.toHaveBeenCalled();
  });

  it("confirmar executa a atualização e devolve a situação nova da CLI", async () => {
    const updated: CliUpdateInfo = { ...claude, installed: "2.1.309", updateAvailable: false };
    vi.mocked(cliUpdateRun).mockResolvedValue(updated);
    const onUpdated = vi.fn();
    render(<CliUpdateNotice infos={[claude]} onUpdated={onUpdated} />);

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    fireEvent.click(screen.getByRole("button", { name: "Atualizar agora" }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    expect(cliUpdateRun).toHaveBeenCalledWith("claude", true);
  });

  it("uma falha da atualização aparece como mensagem, sem travar a faixa", async () => {
    vi.mocked(cliUpdateRun).mockRejectedValue("a atualização falhou: permissão negada");
    render(<CliUpdateNotice infos={[claude]} onUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    fireEvent.click(screen.getByRole("button", { name: "Atualizar agora" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeTruthy();
  });

  it("sem comando de atualização, não mostra o botão", () => {
    render(<CliUpdateNotice infos={[{ ...claude, canUpdate: false }]} onUpdated={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Atualizar" })).toBeNull();
  });
});
