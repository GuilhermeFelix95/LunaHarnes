import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginPrompt } from "./LoginPrompt";

describe("LoginPrompt", () => {
  it("mostra o nome do provedor e dispara os dois botões", () => {
    const onLogin = vi.fn();
    const onCheck = vi.fn();
    render(<LoginPrompt provider="codex" onLogin={onLogin} onCheck={onCheck} checking={false} />);

    expect(screen.getByText(/conta do Codex/)).toBeTruthy();
    fireEvent.click(screen.getByText("Entrar na conta"));
    fireEvent.click(screen.getByText("Já entrei, verificar"));

    expect(onLogin).toHaveBeenCalledOnce();
    expect(onCheck).toHaveBeenCalledOnce();
  });

  it("desabilita a verificação enquanto checa", () => {
    render(<LoginPrompt provider="claude" onLogin={() => {}} onCheck={() => {}} checking />);

    const button = screen.getByText("Verificando...") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("mostra o erro de login dentro do próprio aviso", () => {
    render(
      <LoginPrompt
        provider="claude"
        onLogin={() => {}}
        onCheck={() => {}}
        checking={false}
        error="Claude Code não encontrado no PATH."
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("não encontrado");
  });
});
