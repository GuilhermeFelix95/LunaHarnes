import { Check, Circle } from "lucide-react";
import type { TodoItem } from "../../types";
import { t } from "../../i18n";

const LABEL_KEYS: Record<TodoItem["status"], "progress.status.pending" | "progress.status.in_progress" | "progress.status.completed"> = {
  pending: "progress.status.pending",
  in_progress: "progress.status.in_progress",
  completed: "progress.status.completed",
};

/// Etapas da tarefa como uma linha do tempo: um nó por etapa, ligados por um fio.
/// A etapa em andamento gira o anel, para mostrar onde o agente está trabalhando.
export function ProgressTimeline({ todos }: { todos: TodoItem[] }) {
  const done = todos.filter((t) => t.status === "completed").length;
  const percent = Math.round((done / todos.length) * 100);

  return (
    <div className="timeline">
      <div className="timeline__summary">
        <span>{t("progress.summary", { done, total: todos.length })}</span>
        <div
          className="timeline__bar"
          role="progressbar"
          aria-label={t("progress.barAria")}
          aria-valuemin={0}
          aria-valuemax={todos.length}
          aria-valuenow={done}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>

      <ol className="timeline__steps" aria-label={t("progress.listAria")}>
        {todos.map((todo, index) => (
          <li
            key={`${index}-${todo.content}`}
            className={`timeline__step timeline__step--${todo.status}`}
            aria-current={todo.status === "in_progress" ? "step" : undefined}
          >
            <span className="timeline__node" aria-hidden="true">
              {todo.status === "completed" ? (
                <Check size={12} />
              ) : todo.status === "in_progress" ? (
                <span className="timeline__spinner" />
              ) : (
                <Circle size={6} />
              )}
            </span>
            <span className="timeline__body">
              <span className="timeline__label">{t(LABEL_KEYS[todo.status])}</span>
              <span className="timeline__text">{todo.content}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
