import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";

const CLAUDE_MODELS = [
  { id: "opus", label: "Opus", efforts: ["low", "high", "max"], defaultEffort: null },
  { id: "sonnet", label: "Sonnet", efforts: ["low", "medium"], defaultEffort: null },
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
    providerLocked: false,
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

  it("provedor travado depois da primeira mensagem", () => {
    setup({ providerLocked: true });

    expect((screen.getByLabelText("Provedor") as HTMLSelectElement).disabled).toBe(true);
  });

  it("o seletor de esforço fica desligado enquanto nenhum modelo está escolhido", () => {
    setup({ model: "" });

    expect((screen.getByLabelText("Esforço") as HTMLSelectElement).disabled).toBe(true);
  });

  it("mostra só os níveis que o modelo escolhido aceita", () => {
    setup({ model: "sonnet" });
    const effort = screen.getByLabelText("Esforço") as HTMLSelectElement;
    const levels = Array.from(effort.options).map((o) => o.value);

    expect(effort.disabled).toBe(false);
    expect(levels).toEqual(["", "low", "medium"]);
  });

  it("escolher modelo avisa o componente com o id que a CLI recebe", () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText("Modelo"), { target: { value: "opus" } });

    expect(props.onModel).toHaveBeenCalledWith("opus");
  });

  it("o botão Planejar reflete o modo e alterna ao clicar", () => {
    const props = setup({ planning: true });
    const plan = screen.getByLabelText("Modo de planejamento");

    expect(plan.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(plan);
    expect(props.onTogglePlanning).toHaveBeenCalledOnce();
  });
});
