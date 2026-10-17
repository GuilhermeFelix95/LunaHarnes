import type { ConversationSummary } from "../../types";
import { groupByProject } from "./groupByProject";

interface SidebarProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  /** Sem pasta: usa a pasta de onde o `luna` foi rodado. */
  onNew: (cwd?: string) => void;
  onAddProject: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  error?: string;
}

/// Barra lateral: conversas agrupadas por projeto (pasta), com os dias dentro de cada um.
export function Sidebar({ conversations, activeId, onNew, onAddProject, onOpen, onDelete, error }: SidebarProps) {
  const projects = groupByProject(conversations, new Date());

  return (
    <aside className="sidebar" aria-label="Projetos e conversas">
      <div className="sidebar__top">
        <button type="button" className="sidebar__new" onClick={() => onNew()}>
          Nova conversa
        </button>
        <button type="button" className="sidebar__add" onClick={onAddProject} aria-label="Adicionar projeto">
          +
        </button>
      </div>

      {error && <p role="alert" className="sidebar__error">{error}</p>}

      {projects.length === 0 && <p className="sidebar__empty">Suas conversas aparecem aqui, agrupadas por projeto.</p>}

      {projects.map((project) => (
        <section key={project.cwd} className="sidebar__project">
          <header className="sidebar__project-head">
            <h2 title={project.cwd}>{project.name}</h2>
            <button
              type="button"
              className="sidebar__project-new"
              aria-label={`Nova conversa em ${project.name}`}
              onClick={() => onNew(project.cwd)}
            >
              +
            </button>
          </header>

          {project.days.map((group) => (
            <div key={group.label} className="sidebar__group">
              <h3>{group.label}</h3>
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
            </div>
          ))}
        </section>
      ))}
    </aside>
  );
}
