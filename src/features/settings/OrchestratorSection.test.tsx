import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOrchestrator, listModels, saveOrchestrator } from "../../api";
import { OrchestratorSection } from "./OrchestratorSection";

vi.mock("../../api", () => ({
  getOrchestrator: vi.fn(async () => ({})),
  listModels: vi.fn(async () => [{ id: "gpt-5.5", label: "GPT-5.5", description: null, efforts: [], default: true }]),
  saveOrchestrator: vi.fn(async () => {}),
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

  it("subagentes oferecem só o Claude", async () => {
    render(<OrchestratorSection />);
    const subagentProvider = (await screen.findAllByRole("combobox"))[3];

    const options = Array.from(subagentProvider.querySelectorAll("option")).map((option) => option.value);
    expect(options).toEqual(["", "claude"]);
  });
});
