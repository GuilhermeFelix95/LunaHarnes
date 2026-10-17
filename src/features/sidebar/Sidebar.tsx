import { useState } from "react";
import { Plus, Settings } from "lucide-react";
import lunaLogo from "../../assets/luna.svg";
import type { ConversationSummary } from "../../types";
import { groupByProject } from "./groupByProject";

/// Conversas cujo título contém o texto digitado (sem diferenciar maiúsculas e acentos).
export function filterByTitle(items: ConversationSummary[], query: string): ConversationSummary[] {
  const needle = normalize(query.trim());
  if (!needle) return items;
  return items.filter((item) => normalize(item.title).includes(needle));
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

interface SidebarProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  /** Sem pasta: usa a pasta de onde o `luna` foi rodado. */
  onNew: (cwd?: string) => void;
  onAddProject: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onSettings: () => void;
  /** Página de configurações aberta: marca o botão do rodapé. */
  settingsOpen?: boolean;
  error?: string;
}

/// Barra lateral: conversas agrupadas por projeto (pasta), com os dias dentro de cada um.
export function Sidebar({
  conversations,
  activeId,
  onNew,
  onAddProject,
  onOpen,
  onDelete,
  onSettings,
  settingsOpen = false,
  error,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const matching = filterByTitle(conversations, query);
  const projects = groupByProject(matching, new Date());

  return (
    <aside className="sidebar" aria-label="Projetos e conversas">
      <div className="sidebar__brand">
        <img src={lunaLogo} alt="" />
        <span>LunaHarness</span>
      </div>

      <div className="sidebar__top">
        <button type="button" className="sidebar__new" onClick={() => onNew()}>
          Nova conversa
        </button>
        <button type="button" className="sidebar__add" onClick={onAddProject} aria-label="Adicionar projeto">
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>

      {conversations.length > 0 && (
        <input
          type="search"
          className="sidebar__search"
          aria-label="Buscar conversas"
          placeholder="Buscar conversas"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {error && <p role="alert" className="sidebar__error">{error}</p>}

      {projects.length === 0 && (
        <p className="sidebar__empty">
          {conversations.length === 0
            ? "Suas conversas aparecem aqui, agrupadas por projeto."
            : "Nenhuma conversa encontrada."}
        </p>
      )}

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

      <footer className="sidebar__foot">
        <button type="button" className="sidebar__settings" aria-pressed={settingsOpen} onClick={onSettings}>
          <Settings size={16} aria-hidden="true" /> Configurações
        </button>
      </footer>
    </aside>
  );
}
