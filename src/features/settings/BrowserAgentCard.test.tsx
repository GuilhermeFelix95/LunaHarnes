import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiPresets, listApiProfiles, listModels } from "../../api";
import { getBrowserAgent } from "../../chat/browserAgent";
import { BrowserAgentCard } from "./BrowserAgentCard";

vi.mock("../../api", () => ({
  listApiProfiles: vi.fn(async () => []),
  apiPresets: vi.fn(async () => []),
  listModels: vi.fn(async () => [{ id: "gpt-5.5", label: "GPT-5.5" }]),
}));

describe("Configurações > Navegador > IA do navegador", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("guarda o motor escolhido para o chat do modo navegador", async () => {
    render(<BrowserAgentCard />);
    await waitFor(() => expect(listApiProfiles).toHaveBeenCalled());

    fireEvent.change(screen.getByRole("combobox", { name: "Motor ou perfil do navegador" }), { target: { value: "codex" } });

    expect(getBrowserAgent()).toEqual({ provider: "codex", model: "" });
  });

  it("guarda o modelo escolhido junto com o motor", async () => {
    render(<BrowserAgentCard />);
    await waitFor(() => expect(listApiProfiles).toHaveBeenCalled());
    fireEvent.change(screen.getByRole("combobox", { name: "Motor ou perfil do navegador" }), { target: { value: "codex" } });
    await waitFor(() => expect(listModels).toHaveBeenCalledWith("codex"));

    fireEvent.change(await screen.findByRole("combobox", { name: "Modelo do navegador" }), { target: { value: "gpt-5.5" } });

    expect(getBrowserAgent()).toEqual({ provider: "codex", model: "gpt-5.5" });
  });

  it("escolher 'Conversa atual' limpa a escolha, e o chat volta a usar a conversa", async () => {
    localStorage.setItem("luna.browserAgent", JSON.stringify({ provider: "codex", model: "gpt-5.5" }));
    render(<BrowserAgentCard />);
    await waitFor(() => expect(listApiProfiles).toHaveBeenCalled());

    fireEvent.change(screen.getByRole("combobox", { name: "Motor ou perfil do navegador" }), { target: { value: "" } });

    expect(getBrowserAgent()).toBeUndefined();
  });
});
