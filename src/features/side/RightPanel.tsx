import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ListChecks, PanelRightClose, ScrollText } from "lucide-react";
import { EmptyState } from "../../ui/EmptyState";
import { Markdown } from "../chat/Markdown";
import { LunaAtom } from "./LunaAtom";
import { ProgressTimeline } from "./ProgressTimeline";
import type { TodoItem } from "../../types";

export type SideTab = "changes" | "plan" | "progress" | "terminal";

export const WIDTH_KEY = "luna.rightPanel.width";
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 240;
const MAX_FRACTION = 0.6;
const KEY_STEP = 16;

/// Largura entre 240 px e 60% da janela.
export function clampWidth(width: number, windowWidth: number): number {
  const max = Math.max(MIN_WIDTH, Math.floor(windowWidth * MAX_FRACTION));
  return Math.min(Math.max(Math.round(width), MIN_WIDTH), max);
}

function loadWidth(): number {
  try {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(saved) && saved > 0) return clampWidth(saved, window.innerWidth);
  } catch {
    // Armazenamento indisponível: usa o padrão.
  }
  return DEFAULT_WIDTH;
}

function saveWidth(width: number) {
  try {
    localStorage.setItem(WIDTH_KEY, String(width));
  } catch {
    // Sem armazenamento, a largura vale só nesta sessão.
  }
}

export const OPEN_KEY = "luna.rightPanel.open";

/// Painel aberto por padrão; "0" guarda o fechado.
export function loadOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    // Sem armazenamento, o estado vale só nesta sessão.
  }
}

interface RightPanelProps {
  /** Fechado, o painel só esconde: o terminal continua vivo. */
  open: boolean;
  tab: SideTab;
  onTab: (tab: SideTab) => void;
  /** Fecha o painel pelo X. Pode ser fechado; quem decide quando abre é a conversa. */
  onClose: () => void;
  changes: ReactNode;
  /** Último plano da conversa, em Markdown. Ausente = ainda não há plano. */
  plan?: string;
  /** Checklist do agente na última resposta. Vazio = nenhuma tarefa em andamento. */
  todos: TodoItem[];
  /** A Luna está respondendo: o gatinho digita; parado, ele dorme. */
  running: boolean;
  terminal: ReactNode;
}

const TABS: Array<[SideTab, string]> = [
  ["changes", "Alterações"],
  ["plan", "Plano"],
  ["progress", "Progresso"],
  ["terminal", "Terminal"],
];

/// Painel à direita do chat, com abas e largura ajustável pela alça na borda esquerda.
export function RightPanel({
  open,
  tab,
  onTab,
  onClose,
  changes,
  plan,
  todos,
  running,
  terminal,
}: RightPanelProps) {
  const [width, setWidth] = useState(loadWidth);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  function resize(next: number) {
    const clamped = clampWidth(next, window.innerWidth);
    setWidth(clamped);
    return clamped;
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    drag.current = { startX: e.clientX, startWidth: width };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    // A alça fica na borda esquerda: arrastar para a esquerda alarga.
    resize(drag.current.startWidth + (drag.current.startX - e.clientX));
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const final = resize(drag.current.startWidth + (drag.current.startX - e.clientX));
    drag.current = null;
    saveWidth(final);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === "ArrowLeft" ? KEY_STEP : e.key === "ArrowRight" ? -KEY_STEP : 0;
    if (!delta) return;
    e.preventDefault();
    saveWidth(resize(width + delta));
  }

  return (
    <aside className="side" aria-label="Painel lateral" hidden={!open} style={{ width: `${width}px` }}>
      <div
        className="side__resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Ajustar largura do painel"
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
      />
      <div className="side__tabs" role="tablist" aria-label="Painel lateral">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className="side__tab"
            onClick={() => onTab(id)}
          >
            {label}
          </button>
        ))}
        <button type="button" className="side__close" aria-label="Fechar painel lateral" title="Fechar painel" onClick={onClose}>
          <PanelRightClose size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="side__body" role="tabpanel" hidden={tab !== "changes"}>
        {changes}
      </div>
      <div className="side__body side__plan" role="tabpanel" hidden={tab !== "plan"}>
        {plan ? (
          <Markdown text={plan} />
        ) : (
          <EmptyState icon={<ScrollText size={18} />}>Ao planejar, o plano completo aparece aqui.</EmptyState>
        )}
      </div>
      <div className="side__body" role="tabpanel" hidden={tab !== "progress"}>
        {todos.length ? (
          <ProgressTimeline todos={todos} />
        ) : (
          <EmptyState icon={<ListChecks size={18} />}>Quando o agente montar as etapas da tarefa, elas aparecem em ordem nesta aba.</EmptyState>
        )}
        <LunaAtom working={running} />
      </div>
      <div className="side__body side__body--terminal" role="tabpanel" hidden={tab !== "terminal"}>
        {terminal}
      </div>
    </aside>
  );
}
