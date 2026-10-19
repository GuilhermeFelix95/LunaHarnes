import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentVersion, findUpdate, type AvailableUpdate } from "../../updates";
import { AboutSection } from "./AboutSection";

vi.mock("../../updates", () => ({
  currentVersion: vi.fn(),
  findUpdate: vi.fn(),
}));

const install = vi.fn();
const nova: AvailableUpdate = { version: "0.1.1", notes: "Correções", install };

beforeEach(() => {
  vi.mocked(currentVersion).mockResolvedValue("0.1.0");
  vi.mocked(findUpdate).mockReset();
  install.mockReset();
});

describe("AboutSection", () => {
  it("mostra a versão instalada", async () => {
    render(<AboutSection />);

    expect(await screen.findByText("Versão 0.1.0")).toBeTruthy();
  });

  it("avisa quando já está na versão mais recente", async () => {
    vi.mocked(findUpdate).mockResolvedValue(null);
    render(<AboutSection />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Procurar atualizações" })));

    expect(screen.getByText("Você está na versão mais recente.")).toBeTruthy();
  });

  it("mostra a versão nova e instala ao clicar em Atualizar", async () => {
    vi.mocked(findUpdate).mockResolvedValue(nova);
    install.mockResolvedValue(undefined);
    render(<AboutSection />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Procurar atualizações" })));
    expect(screen.getByText("Versão 0.1.1 disponível.")).toBeTruthy();
    expect(screen.getByText("Correções")).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Atualizar" })));
    expect(install).toHaveBeenCalledTimes(1);
  });

  it("mostra erro quando a verificação falha, sem travar a tela", async () => {
    vi.mocked(findUpdate).mockRejectedValue(new Error("sem rede"));
    render(<AboutSection />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Procurar atualizações" })));

    expect(screen.getByText("Não foi possível verificar atualizações agora. Tente de novo mais tarde.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Procurar atualizações" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
