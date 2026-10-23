import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PermissionRequest } from "../../api";
import { describeAction, PermissionPrompt } from "./PermissionPrompt";

const bash: PermissionRequest = {
  id: "perm-1",
  runId: "conv-1",
  toolName: "Bash",
  input: { command: "npm test" },
  toolUseId: "toolu_1",
};

function renderPrompt(request = bash) {
  const handlers = { onAllow: vi.fn(), onAlways: vi.fn(), onDeny: vi.fn() };
  render(<PermissionPrompt request={request} {...handlers} />);
  return handlers;
}

describe("PermissionPrompt", () => {
  it("mostra a ferramenta e a ação que o agente quer executar", () => {
    renderPrompt();
    expect(screen.getByText("O agente quer executar Bash")).toBeTruthy();
    expect(screen.getByText("npm test")).toBeTruthy();
  });

  it("permitir devolve o pedido à conversa", () => {
    const handlers = renderPrompt();
    fireEvent.click(screen.getByRole("button", { name: "Permitir" }));
    expect(handlers.onAllow).toHaveBeenCalledWith(bash);
    expect(handlers.onDeny).not.toHaveBeenCalled();
  });

  it("negar devolve o pedido à conversa", () => {
    const handlers = renderPrompt();
    fireEvent.click(screen.getByRole("button", { name: "Negar" }));
    expect(handlers.onDeny).toHaveBeenCalledWith(bash);
    expect(handlers.onAllow).not.toHaveBeenCalled();
  });

  it("sempre nesta conversa devolve o pedido com a escolha de liberar a ferramenta", () => {
    const handlers = renderPrompt();
    fireEvent.click(screen.getByRole("button", { name: "Sempre nesta conversa" }));
    expect(handlers.onAlways).toHaveBeenCalledWith(bash);
    expect(handlers.onAllow).not.toHaveBeenCalled();
  });

  it("não mostra linha de ação quando a ferramenta não tem comando, arquivo ou URL", () => {
    renderPrompt({ ...bash, toolName: "TaskCreate", input: { steps: [] } });
    expect(screen.queryByText("npm test")).toBeNull();
    expect(describeAction({ ...bash, input: { steps: [] } })).toBe("");
  });

  it("usa o arquivo quando a ferramenta é de edição", () => {
    expect(describeAction({ ...bash, toolName: "Write", input: { file_path: "src/a.ts", content: "x" } })).toBe("src/a.ts");
  });
});
