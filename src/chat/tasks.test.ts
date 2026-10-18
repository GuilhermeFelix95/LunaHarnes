import { describe, expect, it } from "vitest";
import { applyTaskEvent, toTodos, type TaskEntry } from "./tasks";

describe("tarefas do agente", () => {
  it("cria na ordem, liga o id devolvido e atualiza o estado sem mudar a ordem", () => {
    let list: TaskEntry[] = [];
    list = applyTaskEvent(list, { kind: "taskCreated", key: "t1", subject: "Criar hello.txt" });
    list = applyTaskEvent(list, { kind: "taskCreated", key: "t2", subject: "Verificar" });
    list = applyTaskEvent(list, { kind: "taskAssigned", key: "t1", id: "1" });
    list = applyTaskEvent(list, { kind: "taskAssigned", key: "t2", id: "2" });
    list = applyTaskEvent(list, { kind: "taskUpdated", id: "2", status: "in_progress", subject: null });
    list = applyTaskEvent(list, { kind: "taskUpdated", id: "1", status: "completed", subject: null });

    expect(toTodos(list)).toEqual([
      { content: "Criar hello.txt", status: "completed" },
      { content: "Verificar", status: "in_progress" },
    ]);
  });

  it("tarefa marcada como deleted some da lista", () => {
    let list: TaskEntry[] = [];
    list = applyTaskEvent(list, { kind: "taskCreated", key: "t1", subject: "Errada" });
    list = applyTaskEvent(list, { kind: "taskAssigned", key: "t1", id: "1" });
    list = applyTaskEvent(list, { kind: "taskUpdated", id: "1", status: "deleted", subject: null });

    expect(list).toEqual([]);
  });

  it("atualização de uma tarefa que ainda não tem id é ignorada, sem quebrar a lista", () => {
    const before: TaskEntry[] = [{ key: "t1", content: "Criar", status: "pending" }];

    const after = applyTaskEvent(before, { kind: "taskUpdated", id: "9", status: "completed", subject: null });

    expect(after).toEqual(before);
  });

  it("o checklist do TodoWrite (e do Codex) substitui a lista inteira", () => {
    let list: TaskEntry[] = [{ key: "t1", id: "1", content: "Antiga", status: "pending" }];

    list = applyTaskEvent(list, {
      kind: "todos",
      items: [
        { content: "Primeira", status: "completed" },
        { content: "Segunda", status: "in_progress" },
      ],
    });

    expect(toTodos(list)).toEqual([
      { content: "Primeira", status: "completed" },
      { content: "Segunda", status: "in_progress" },
    ]);
    expect(list.map((task) => task.key)).toEqual(["todo-0", "todo-1"]);
  });

  it("um novo nome em TaskUpdate troca o texto da tarefa", () => {
    let list: TaskEntry[] = [{ key: "t1", id: "1", content: "Antigo", status: "pending" }];

    list = applyTaskEvent(list, { kind: "taskUpdated", id: "1", status: null, subject: "Novo nome" });

    expect(toTodos(list)).toEqual([{ content: "Novo nome", status: "pending" }]);
  });
});
