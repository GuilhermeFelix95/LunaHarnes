import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOrchestrator, listModels, saveOrchestrator } from "../../api";
import { OrchestratorSection } from "./OrchestratorSection";

vi.mock("../../api", () => ({
  getOrchestrator: vi.fn(async () => ({})),
  listModels: vi.fn(async () => [{ id: "gpt-5.5", label: "GPT-5.5", description: null, efforts: [], default: true }]),
  saveOrchestrator: vi.fn(async () => {}),
  listApiProfiles: vi.fn(async () => [
    { id: "p1", name: "DeepSeek", preset: "deepseek", baseUrl: "", models: ["deepseek-flash"], defaultModel: "deepseek-flash" },
  ]),
  apiPresets: vi.fn(async () => [{ preset: "deepseek", label: "DeepSeek", engine: "claude", defaultBaseUrl: "", suggestedModels: [], defaultModel: "" }]),
}));

describe("Configurações > Orquestrador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrchestrator).mockResolvedValue({});
  });

  it("sem escolha salva, cada papel começa na conversa atual", async () => {
    render(<OrchestratorSection />);

    expect(await screen.findByText("Planejar")).toBeTruthy();
    expect(screen.getAllByRole("combobox", { name: /Planejar|Executar|Conversar/ })).toHaveLength(3);
    expect(saveOrchestrator).not.toHaveBeenCalled();
  });

  it("escolher motor e modelo grava o papel", async () => {
    render(<OrchestratorSection />);
    const planProvider = (await screen.findAllByRole("combobox"))[0];

    fireEvent.change(planProvider, { target: { value: "codex" } });
    // Motor escolhido sem modelo ainda não grava: a lista do motor chega primeiro.
    expect(saveOrchestrator).not.toHaveBeenCalled();

    await waitFor(() => expect(listModels).toHaveBeenCalledWith("codex"));
    const planModel = (await screen.findAllByRole("combobox"))[1];
    fireEvent.change(planModel, { target: { value: "gpt-5.5" } });

    await waitFor(() => expect(saveOrchestrator).toHaveBeenCalledWith({ plan: { provider: "codex", model: "gpt-5.5" } }));
  });

  it("subagentes oferecem só o Claude, sem perfil", async () => {
    render(<OrchestratorSection />);
    const subagentProvider = (await screen.findAllByRole("combobox"))[3];

    const options = Array.from(subagentProvider.querySelectorAll("option")).map((option) => option.value);
    expect(options).toEqual(["", "claude"]);
  });

  it("um papel pode usar um perfil de API: lista os modelos do perfil e grava o perfil", async () => {
    render(<OrchestratorSection />);
    const chatProvider = (await screen.findAllByRole("combobox"))[2];

    fireEvent.change(chatProvider, { target: { value: "api:p1" } });
    const chatModel = (await screen.findAllByRole("combobox", { name: "Modelo" }))[0];
    fireEvent.change(chatModel, { target: { value: "deepseek-flash" } });

    await waitFor(() =>
      expect(saveOrchestrator).toHaveBeenCalledWith({ chat: { provider: "claude", profileId: "p1", model: "deepseek-flash" } }),
    );
    expect(listModels).not.toHaveBeenCalledWith("claude");
  });
});
