import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TodoItem } from "../../types";
import { clampWidth, loadOpen, OPEN_KEY, RightPanel, saveOpen, WIDTH_KEY, type SideTab } from "./RightPanel";

function setup(tab: SideTab = "changes", plan?: string, todos: TodoItem[] = []) {
  const onTab = vi.fn();
  const onClose = vi.fn();
  render(
    <RightPanel
      open
      tab={tab}
      onTab={onTab}
      onClose={onClose}
      changes={<p>lista de alterações</p>}
      plan={plan}
      todos={todos}
      running={false}
      terminal={<p>shell</p>}
      browser={<p>página do navegador</p>}
    />,
  );
  return { onTab, onClose };
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

  it("a aba Navegador fica depois do Terminal e avisa quando é escolhida", () => {
    const { onTab } = setup("terminal");

    const names = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(names.slice(-2)).toEqual(["Terminal", "Navegador"]);
    fireEvent.click(screen.getByRole("tab", { name: "Navegador" }));
    expect(onTab).toHaveBeenCalledWith("browser");
  });

  it("o navegador continua montado quando outra aba está à mostra", () => {
    setup("changes");

    expect(screen.getByText("página do navegador")).toBeTruthy();
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

  it("a aba Plano não tem botão de spec: a spec sai do plano aprovado, em spec/", () => {
    setup("plan", "## Plano\n\nFazer X.");

    expect(screen.queryByRole("button", { name: "Gerar spec" })).toBeNull();
  });

  it("progresso mostra as tarefas na ordem em que foram criadas, com o estado de cada uma", () => {
    setup("progress", undefined, [
      { content: "Concluir a tela", status: "completed" },
      { content: "Criar o teste", status: "pending" },
      { content: "Ligar o evento", status: "in_progress" },
    ]);

    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual([
      "ConcluídaConcluir a tela",
      "Na filaCriar o teste",
      "Em andamentoLigar o evento",
    ]);
  });

  it("progresso com muitas tarefas rola dentro da lista, e o mascote fica fora dela", () => {
    setup("progress", undefined, [
      { content: "Tarefa 1", status: "completed" },
      { content: "Tarefa 2", status: "pending" },
    ]);

    const list = screen.getAllByRole("listitem")[0].closest(".side__progress-list");
    const atom = document.querySelector(".luna-atom");
    expect(list).toBeTruthy();
    expect(atom).toBeTruthy();
    expect(atom?.closest(".side__progress-list")).toBeNull();
  });

  it("sem checklist, a aba Progresso explica como aparece", () => {
    setup("progress");

    expect(screen.getByText(/elas aparecem em ordem/)).toBeTruthy();
  });

  it("o X fecha o painel", () => {
    const { onClose } = setup("changes");

    fireEvent.click(screen.getByRole("button", { name: "Fechar painel lateral" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("o estado aberto ou fechado fica salvo; padrão é aberto", () => {
    expect(loadOpen()).toBe(true);

    saveOpen(false);
    expect(localStorage.getItem(OPEN_KEY)).toBe("0");
    expect(loadOpen()).toBe(false);
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
