import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TodoItem } from "../../types";
import { clampWidth, RightPanel, sortTodos, WIDTH_KEY } from "./RightPanel";

function setup(tab: "changes" | "plan" | "progress" | "terminal" = "changes", plan?: string, todos: TodoItem[] = []) {
  const onTab = vi.fn();
  const onGenerateSpec = vi.fn();
  render(
    <RightPanel
      open
      tab={tab}
      onTab={onTab}
      changes={<p>lista de alterações</p>}
      plan={plan}
      todos={todos}
      onGenerateSpec={onGenerateSpec}
      canGenerateSpec
      terminal={<p>shell</p>}
    />,
  );
  return { onTab, onGenerateSpec };
}

describe("RightPanel", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });
  });

  it("mantém o terminal montado ao mostrar outra aba, para não perder o shell", () => {
    setup("changes");

    expect(screen.getByText("shell").closest("[hidden]")).toBeTruthy();
    expect(screen.getByText("lista de alterações").closest("[hidden]")).toBeNull();
  });

  it("as abas avisam qual foi escolhida", () => {
    const { onTab } = setup("changes");

    fireEvent.click(screen.getByRole("tab", { name: "Terminal" }));

    expect(onTab).toHaveBeenCalledWith("terminal");
  });

  it("arrastar a alça muda a largura e salva", () => {
    setup();
    const handle = screen.getByRole("separator", { name: "Ajustar largura do painel" });
    const panel = screen.getByRole("complementary", { name: "Painel lateral" });

    fireEvent.pointerDown(handle, { clientX: 700, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 600, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 600, pointerId: 1 });

    expect(panel.style.width).toBe("420px");
    expect(localStorage.getItem(WIDTH_KEY)).toBe("420");
  });

  it("teclas de seta ajustam a largura respeitando os limites", () => {
    localStorage.setItem(WIDTH_KEY, "250");
    setup();
    const handle = screen.getByRole("separator", { name: "Ajustar largura do painel" });
    const panel = screen.getByRole("complementary", { name: "Painel lateral" });

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(panel.style.width).toBe("240px");
  });

  it("mostra o plano completo na aba Plano, em Markdown", () => {
    setup("plan", "## Solution\n\nFazer **X** primeiro.");

    expect(screen.getByRole("heading", { name: "Solution" })).toBeTruthy();
    expect(screen.getByText("X").tagName).toBe("STRONG");
  });

  it("sem plano, a aba explica como gerar um", () => {
    setup("plan");

    expect(screen.getByText(/aparece aqui/)).toBeTruthy();
  });

  it("Gerar spec chama o handler da conversa", () => {
    const { onGenerateSpec } = setup("plan");

    fireEvent.click(screen.getByRole("button", { name: "Gerar spec" }));

    expect(onGenerateSpec).toHaveBeenCalledOnce();
  });

  it("progresso mostra o checklist: pendente, em andamento, concluída", () => {
    setup("progress", undefined, [
      { content: "Concluir a tela", status: "completed" },
      { content: "Criar o teste", status: "pending" },
      { content: "Ligar o evento", status: "in_progress" },
    ]);

    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual([
      "PendenteCriar o teste",
      "Em andamentoLigar o evento",
      "ConcluídaConcluir a tela",
    ]);
  });

  it("sem checklist, a aba Progresso explica como aparece", () => {
    setup("progress");

    expect(screen.getByText(/elas aparecem em ordem/)).toBeTruthy();
  });

  it("sortTodos mantém a ordem do agente dentro de cada estado", () => {
    const sorted = sortTodos([
      { content: "b", status: "completed" },
      { content: "a", status: "pending" },
      { content: "c", status: "pending" },
    ]);

    expect(sorted.map((todo) => todo.content)).toEqual(["a", "c", "b"]);
  });

  it("largura fica entre 240 px e 60% da janela", () => {
    expect(clampWidth(100, 1000)).toBe(240);
    expect(clampWidth(900, 1000)).toBe(600);
    expect(clampWidth(400, 1000)).toBe(400);
  });

  it("valor salvo inválido volta para o padrão", () => {
    localStorage.setItem(WIDTH_KEY, "abc");
    setup();

    expect(screen.getByRole("complementary", { name: "Painel lateral" }).style.width).toBe("320px");
  });
});
