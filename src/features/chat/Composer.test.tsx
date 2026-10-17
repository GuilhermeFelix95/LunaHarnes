import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";

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
});
