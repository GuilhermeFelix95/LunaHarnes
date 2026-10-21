import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Globe, Pencil, Plus, Settings, Trash2 } from "lucide-react";
import type { ConversationSummary } from "../../types";
import { EmptyState } from "../../ui/EmptyState";
import { t, type MessageKey } from "../../i18n";
import type { ConversationGroup } from "./groupByDay";
import { groupByProject } from "./groupByProject";
import { PlanTarget } from "./PlanTarget";

export const SIDEBAR_WIDTH_KEY = "luna.sidebar.width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_FRACTION = 0.4;
const KEY_STEP = 16;

/// Nome de cada grupo de dia, traduzido. O rótulo interno continua em português (ver groupByDay).
const DAY_KEYS: Record<ConversationGroup["label"], MessageKey> = {
  Hoje: "sidebar.day.today",
  Ontem: "sidebar.day.yesterday",
  Anteriores: "sidebar.day.earlier",
};

/// Largura entre 200 px e 40% da janela.
export function clampSidebarWidth(width: number, windowWidth: number): number {
  const max = Math.max(MIN_WIDTH, Math.floor(windowWidth * MAX_FRACTION));
  return Math.min(Math.max(Math.round(width), MIN_WIDTH), max);
}

function loadWidth(): number {
  try {
    const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(saved) && saved > 0) return clampSidebarWidth(saved, window.innerWidth);
  } catch {
    // Armazenamento indisponível: usa o padrão.
  }
  return DEFAULT_WIDTH;
}

function saveWidth(width: number) {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  } catch {
    // Sem armazenamento, a largura vale só nesta sessão.
  }
}

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
  /** Conversas com resposta em andamento: ganham um indicador. */
  runningIds?: string[];
  /** Sem pasta: usa a pasta de onde o `luna` foi rodado. */
  onNew: (cwd?: string) => void;
  onAddProject: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  /** Troca o título de uma conversa (o nome vale mesmo se a conversa for salva de novo). */
  onRename?: (id: string, title: string) => void;
  /** Remove o projeto (a pasta) da barra lateral e as conversas dele. A confirmação fica com quem chama. */
  onRemoveProject?: (cwd: string) => void;
  onSettings: () => void;
  /** Página de configurações aberta: marca o botão do rodapé. */
  settingsOpen?: boolean;
  /** Modo navegador ligado: o botão abaixo de Configurações vira Modo LunaCode. */
  browserMode?: boolean;
  onBrowserMode?: (on: boolean) => void;
  error?: string;
}

/// Barra lateral: conversas agrupadas por projeto (pasta), com os dias dentro de cada um.
export function Sidebar({
  conversations,
  activeId,
  runningIds = [],
  onNew,
  onAddProject,
  onOpen,
  onDelete,
  onRename,
  onRemoveProject,
  onSettings,
  settingsOpen = false,
  browserMode = false,
  onBrowserMode,
  error,
}: SidebarProps) {
  // Largura ajustável pela alça na borda direita, como o painel da direita.
  const [width, setWidth] = useState(loadWidth);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  // Conversa com o nome em edição e o texto digitado até agora.
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);

  function startRename(item: ConversationSummary) {
    setRenaming({ id: item.id, draft: item.title });
  }

  function finishRename(id: string) {
    const title = renaming?.draft.trim() ?? "";
    if (!title) return;
    setRenaming(null);
    onRename?.(id, title);
  }

  function resize(next: number) {
    const clamped = clampSidebarWidth(next, window.innerWidth);
    setWidth(clamped);
    return clamped;
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    drag.current = { startX: e.clientX, startWidth: width };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    resize(drag.current.startWidth + (e.clientX - drag.current.startX));
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const final = resize(drag.current.startWidth + (e.clientX - drag.current.startX));
    drag.current = null;
    saveWidth(final);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === "ArrowRight" ? KEY_STEP : e.key === "ArrowLeft" ? -KEY_STEP : 0;
    if (!delta) return;
    e.preventDefault();
    saveWidth(resize(width + delta));
  }

  const [query, setQuery] = useState("");
  const matching = filterByTitle(conversations, query);
  const projects = groupByProject(matching, new Date());

  return (
    <aside className={`sidebar${browserMode ? " sidebar--collapsed" : ""}`} aria-label={t("sidebar.label")} style={{ width: `${width}px` }}>
      <div
        className="sidebar__resize"
        role="separator"
        aria-orientation="vertical"
        aria-label={t("sidebar.resize")}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
      />
      <div className="sidebar__brand">
        <img src="/luna/logo.svg" alt="" />
        <span>LunaCode</span>
      </div>

      <div className="sidebar__top">
        <button type="button" className="sidebar__new" onClick={() => onNew()}>
          <Plus size={15} aria-hidden="true" />
          {t("sidebar.newConversation")}
        </button>
        <button type="button" className="sidebar__add" onClick={onAddProject} aria-label={t("sidebar.addProject")}>
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>

      {conversations.length > 0 && (
        <input
          type="search"
          className="sidebar__search"
          aria-label={t("sidebar.searchAria")}
          placeholder={t("sidebar.searchAria")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {/* Só esta área rola; a marca, a busca e o rodapé ficam sempre visíveis. */}
      <div className="sidebar__list">
        {error && <p role="alert" className="sidebar__error">{error}</p>}

        {projects.length === 0 && (
          <EmptyState>
            {conversations.length === 0 ? t("sidebar.emptyNone") : t("sidebar.emptyNoMatch")}
          </EmptyState>
        )}

        {projects.map((project) => (
          <section key={project.cwd} className="sidebar__project">
            <header className="sidebar__project-head">
              <h2 title={project.cwd}>{project.name}</h2>
              <span className="sidebar__project-actions">
                <button
                  type="button"
                  className="sidebar__project-new"
                  aria-label={t("sidebar.newIn", { name: project.name })}
                  onClick={() => onNew(project.cwd)}
                >
                  +
                </button>
                {onRemoveProject && (
                  <button
                    type="button"
                    className="sidebar__project-remove"
                    aria-label={t("sidebar.removeProject", { name: project.name })}
                    title={t("sidebar.removeProjectTitle")}
                    onClick={() => onRemoveProject(project.cwd)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                )}
              </span>
            </header>

            {project.days.map((group) => (
              <div key={group.label} className="sidebar__group">
                <h3>{t(DAY_KEYS[group.label])}</h3>
                <ul>
                  {group.items.map((item) =>
                    renaming?.id === item.id ? (
                      <li key={item.id} className="is-active">
                        <input
                          type="text"
                          className="sidebar__rename"
                          aria-label={t("sidebar.renameAria")}
                          autoFocus
                          value={renaming.draft}
                          onChange={(e) => setRenaming({ id: item.id, draft: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") finishRename(item.id);
                            if (e.key === "Escape") setRenaming(null);
                          }}
                          onBlur={() => setRenaming(null)}
                        />
                      </li>
                    ) : (
                      <li key={item.id} className={item.id === activeId ? "is-active" : undefined}>
                        <button
                          type="button"
                          className="sidebar__item"
                          onClick={() => onOpen(item.id)}
                          onDoubleClick={() => onRename && startRename(item)}
                          title={item.title}
                        >
                          {runningIds.includes(item.id) && (
                            <span className="sidebar__running" role="img" aria-label={t("sidebar.replying")} />
                          )}
                          {item.title}
                        </button>
                        {onRename && (
                          <button
                            type="button"
                            className="sidebar__rename-btn"
                            aria-label={t("sidebar.renameItem", { title: item.title })}
                            title={t("sidebar.rename")}
                            onClick={() => startRename(item)}
                          >
                            <Pencil size={12} aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          className="sidebar__delete"
                          aria-label={t("sidebar.deleteItem", { title: item.title })}
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </div>

      <div data-plugin-slot="sidebar" />
      <footer className="sidebar__foot">
        <button type="button" className="sidebar__settings" aria-pressed={settingsOpen} onClick={onSettings}>
          <Settings size={16} aria-hidden="true" /> {t("settings.title")}
        </button>
        {onBrowserMode && (
          <button
            type="button"
            className="sidebar__settings sidebar__browser"
            aria-pressed={browserMode}
            onClick={() => onBrowserMode(!browserMode)}
          >
            <Globe size={16} aria-hidden="true" /> {browserMode ? t("sidebar.lunaCodeMode") : t("sidebar.browserMode")}
          </button>
        )}
        <PlanTarget />
      </footer>
    </aside>
  );
}
