import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";

const effort = (id: string, label: string, recommended = false) => ({ id, label, recommended });

const CLAUDE_MODELS = [
  {
    id: "claude-opus-5-5",
    label: "Opus 5.5",
    description: "Para trabalho complexo",
    efforts: [effort("low", "Low"), effort("medium", "Medium", true), effort("max", "Max")],
    default: false,
  },
  {
    id: "claude-sonnet-5-5",
    label: "Sonnet 5.5",
    description: "Mais eficiente",
    efforts: [effort("low", "Low"), effort("medium", "Medium", true)],
    default: false,
  },
];

function setup(overrides: Partial<Parameters<typeof Composer>[0]> = {}) {
  const props = {
    draft: "olá",
    onDraft: vi.fn(),
    onSend: vi.fn(),
    onStop: vi.fn(),
    running: false,
    blocked: false,
    provider: "claude" as const,
    onProvider: vi.fn(),
    permission: "acceptEdits" as const,
    onPermission: vi.fn(),
    models: CLAUDE_MODELS,
    model: "",
    onModel: vi.fn(),
    effort: "",
    onEffort: vi.fn(),
    planning: false,
    onTogglePlanning: vi.fn(),
    ...overrides,
  };
  render(<Composer {...props} />);
  return props;
}

describe("Composer", () => {
  it("Enter envia a mensagem", () => {
    const props = setup();
    fireEvent.keyDown(screen.getByLabelText("Mensagem"), { key: "Enter" });

    expect(props.onSend).toHaveBeenCalledOnce();
  });

  it("Shift+Enter não envia (quebra de linha)", () => {
    const props = setup();
    fireEvent.keyDown(screen.getByLabelText("Mensagem"), { key: "Enter", shiftKey: true });

    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("Enter não envia texto vazio", () => {
    const props = setup({ draft: "   " });
    fireEvent.keyDown(screen.getByLabelText("Mensagem"), { key: "Enter" });

    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("durante a execução o botão vira Parar", () => {
    const props = setup({ running: true });
    fireEvent.click(screen.getByLabelText("Parar"));

    expect(props.onStop).toHaveBeenCalledOnce();
  });

  it("bloqueado (sem login) não aceita envio", () => {
    const props = setup({ blocked: true });
    fireEvent.keyDown(screen.getByLabelText("Mensagem"), { key: "Enter" });

    expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(true);
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("o provedor pode ser trocado no meio da conversa, só não durante uma resposta", () => {
    setup();
    expect((screen.getByLabelText("Provedor") as HTMLSelectElement).disabled).toBe(false);
  });

  it("o seletor de esforço fica desligado enquanto nenhum modelo está escolhido", () => {
    setup({ model: "" });

    expect((screen.getByLabelText("Esforço") as HTMLSelectElement).disabled).toBe(true);
  });

  it("mostra só os níveis que o modelo escolhido aceita", () => {
    setup({ model: "claude-sonnet-5-5" });
    const levels = Array.from((screen.getByLabelText("Esforço") as HTMLSelectElement).options).map((o) => o.value);

    expect(levels).toEqual(["", "low", "medium"]);
  });

  it("marca o nível recomendado com o nome que o Desktop usa", () => {
    setup({ model: "claude-opus-5-5" });
    const options = Array.from((screen.getByLabelText("Esforço") as HTMLSelectElement).options).map((o) => o.textContent);

    expect(options).toContain("Medium (recomendado)");
  });

  it("o seletor de modelo mostra o nome e a descrição de cada modelo", () => {
    setup();
    fireEvent.click(screen.getByLabelText("Modelo"));

    expect(screen.getByRole("option", { name: /Opus 5\.5/ })).toBeTruthy();
    expect(screen.getByText("Para trabalho complexo")).toBeTruthy();
    expect(screen.getByRole("option", { name: /Sonnet 5\.5/ })).toBeTruthy();
  });

  it("o seletor de modelo lista só os modelos suportados, sem 'Padrão da CLI'", () => {
    setup({ model: "claude-opus-5-5" });
    fireEvent.click(screen.getByLabelText("Modelo"));

    expect(screen.queryByText("Padrão da CLI")).toBeNull();
    const list = screen.getByRole("listbox", { name: "Modelos" });
    expect(within(list).getAllByRole("option")).toHaveLength(2);
  });

  it("escolher um modelo manda o ID da CLI, não o nome de exibição", () => {
    const props = setup();
    fireEvent.click(screen.getByLabelText("Modelo"));
    fireEvent.click(screen.getByRole("option", { name: /Opus 5\.5/ }));

    expect(props.onModel).toHaveBeenCalledWith("claude-opus-5-5");
  });

  it("o botão Planejar reflete o modo e alterna ao clicar", () => {
    const props = setup({ planning: true });
    const plan = screen.getByLabelText("Modo de planejamento");

    expect(plan.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(plan);
    expect(props.onTogglePlanning).toHaveBeenCalledOnce();
  });
});
