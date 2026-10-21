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

describe("Configurações > Orquestrador > esforço do modelo", () => {
  const withEfforts = [
    { id: "gpt-5.5", label: "GPT-5.5", description: null, default: true, efforts: [
      { id: "low", label: "Low", recommended: false },
      { id: "high", label: "High", recommended: true },
    ] },
    { id: "plain", label: "Plain", description: null, default: false, efforts: [] },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listModels).mockImplementation(async () => withEfforts);
  });

  it("o campo de esforço aparece só para modelo que tem níveis e grava a escolha", async () => {
    vi.mocked(getOrchestrator).mockResolvedValue({});
    render(<OrchestratorSection />);
    const planProvider = (await screen.findAllByRole("combobox"))[0];
    fireEvent.change(planProvider, { target: { value: "codex" } });
    await waitFor(() => expect(listModels).toHaveBeenCalledWith("codex"));

    fireEvent.change((await screen.findAllByRole("combobox", { name: "Modelo" }))[0], { target: { value: "gpt-5.5" } });
    const effort = (await screen.findByRole("combobox", { name: "Esforço" })) as HTMLSelectElement;
    expect(Array.from(effort.querySelectorAll("option")).map((o) => o.textContent)).toEqual(["Padrão do modelo", "Low", "High"]);

    fireEvent.change(effort, { target: { value: "high" } });
    await waitFor(() =>
      expect(saveOrchestrator).toHaveBeenLastCalledWith({ plan: { provider: "codex", model: "gpt-5.5", effort: "high" } }),
    );
  });

  it("trocar para um modelo sem níveis limpa o esforço escolhido", async () => {
    vi.mocked(getOrchestrator).mockResolvedValue({ plan: { provider: "codex", model: "gpt-5.5", effort: "high" } });
    render(<OrchestratorSection />);
    await waitFor(() => expect(listModels).toHaveBeenCalledWith("codex"));

    fireEvent.change(await screen.findByRole("combobox", { name: "Modelo" }), { target: { value: "plain" } });

    expect(screen.queryByRole("combobox", { name: "Esforço" })).toBeNull();
    await waitFor(() => expect(saveOrchestrator).toHaveBeenCalled());
    const saved = vi.mocked(saveOrchestrator).mock.calls.at(-1)?.[0];
    expect(saved?.plan?.model).toBe("plain");
    expect(saved?.plan?.effort).toBeUndefined();
  });
});
