import type { ProviderEvent, TodoItem } from "../types";

/// Uma tarefa do agente na aba Progresso. `key` liga o TaskCreate ao resultado; `id` é o do Claude Code.
export interface TaskEntry {
  key: string;
  id?: string;
  content: string;
  status: TodoItem["status"];
}

type TaskEvent = Extract<ProviderEvent, { kind: "taskCreated" | "taskAssigned" | "taskUpdated" | "todos" }>;

function isStatus(value: string | null): value is TodoItem["status"] {
  return value === "pending" || value === "in_progress" || value === "completed";
}

/// Aplica um evento de tarefa à lista, na ordem em que as tarefas foram criadas.
/// Atualização de uma tarefa que ainda não tem id é ignorada; não quebra a lista.
export function applyTaskEvent(list: TaskEntry[], event: TaskEvent): TaskEntry[] {
  switch (event.kind) {
    case "taskCreated":
      return [...list, { key: event.key, content: event.subject, status: "pending" }];
    case "taskAssigned":
      return list.map((task) => (task.key === event.key ? { ...task, id: event.id } : task));
    case "taskUpdated":
      if (event.status === "deleted") return list.filter((task) => task.id !== event.id);
      return list.map((task) =>
        task.id !== event.id
          ? task
          : {
              ...task,
              content: event.subject ?? task.content,
              status: isStatus(event.status) ? event.status : task.status,
            },
      );
    case "todos":
      // O checklist do TodoWrite (e do Codex) chega inteiro a cada atualização.
      return event.items.map((item, index) => ({ key: `todo-${index}`, content: item.content, status: item.status }));
  }
}

/// Só o que a aba mostra: texto e estado, na mesma ordem.
export function toTodos(list: TaskEntry[]): TodoItem[] {
  return list.map(({ content, status }) => ({ content, status }));
}
