import type { BackgroundTask, BackgroundTaskStatus } from "../../types";
import { t, type MessageKey } from "../../i18n";

const STATUS_KEYS: Record<BackgroundTaskStatus, MessageKey> = {
  running: "chat.background.running",
  done: "chat.background.done",
  failed: "chat.background.failed",
  stopped: "chat.background.stopped",
};

interface BackgroundTasksProps {
  /** Tarefas desta sessão do app, na ordem em que começaram. */
  tasks: BackgroundTask[];
  /** Para uma tarefa que ainda está rodando. */
  onStop: (id: string) => void;
}

/// Lista das tarefas em segundo plano, acima do composer: pedido, estado e o botão de parar.
/// O resultado de cada uma entra na conversa quando ela termina.
export function BackgroundTasks({ tasks, onStop }: BackgroundTasksProps) {
  return (
    <section className="background-tasks" aria-label={t("chat.backgroundAria")}>
      <p className="background-tasks__title">{t("chat.backgroundTitle")}</p>
      <ul className="background-tasks__list">
        {tasks.map((task) => (
          <li key={task.id} className={`background-tasks__item background-tasks__item--${task.status}`}>
            <span className="background-tasks__prompt" title={task.prompt}>
              {task.prompt}
            </span>
            <span className="background-tasks__status">{t(STATUS_KEYS[task.status])}</span>
            {task.status === "running" && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => onStop(task.id)}>
                {t("chat.backgroundStop")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
