import type { ConversationSummary } from "../../types";
import { groupByDay } from "./groupByDay";

interface SidebarProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  error?: string;
}

/// Barra lateral com o histórico de conversas agrupado por dia.
export function Sidebar({ conversations, activeId, onNew, onOpen, onDelete, error }: SidebarProps) {
  const groups = groupByDay(conversations, new Date());

  return (
    <aside className="sidebar" aria-label="Histórico de conversas">
      <button type="button" className="sidebar__new" onClick={onNew}>
        Nova conversa
      </button>

      {error && <p role="alert" className="sidebar__error">{error}</p>}

      {groups.length === 0 && <p className="sidebar__empty">Suas conversas aparecem aqui.</p>}

      {groups.map((group) => (
        <section key={group.label} className="sidebar__group">
          <h2>{group.label}</h2>
          <ul>
            {group.items.map((item) => (
              <li key={item.id} className={item.id === activeId ? "is-active" : undefined}>
                <button
                  type="button"
                  className="sidebar__item"
                  onClick={() => onOpen(item.id)}
                  title={item.title}
                >
                  {item.title}
                </button>
                <button
                  type="button"
                  className="sidebar__delete"
                  aria-label={`Excluir ${item.title}`}
                  onClick={() => onDelete(item.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}
