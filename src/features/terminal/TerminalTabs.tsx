import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { TerminalPanel } from "./TerminalPanel";
import { t } from "../../i18n";

/// Mesmo limite do backend (src-tauri/src/terminal.rs).
export const MAX_TERMINALS = 4;

interface TerminalTabsProps {
  /** Pasta onde os shells começam. Quem usa o painel troca a pasta com key={cwd}, o que reinicia os shells. */
  cwd: string;
}

/// Terminais do painel. Cada aba é um shell próprio: a aba que não está selecionada só fica escondida, sem fechar o shell.
export function TerminalTabs({ cwd }: TerminalTabsProps) {
  const nextId = useRef(2);
  const [tabs, setTabs] = useState<number[]>([1]);
  const [active, setActive] = useState(1);
  const atLimit = tabs.length >= MAX_TERMINALS;

  function add() {
    if (atLimit) return;
    const id = nextId.current++;
    setTabs((current) => [...current, id]);
    setActive(id);
  }

  function close(id: number) {
    const remaining = tabs.filter((tab) => tab !== id);
    setTabs(remaining);
    if (active === id) setActive(remaining[remaining.length - 1] ?? 0);
  }

  return (
    <div className="terminal-tabs">
      <div className="terminal-tabs__bar" role="tablist">
        {tabs.map((id, index) => (
          <div className="terminal-tabs__tab" key={id}>
            <button
              type="button"
              role="tab"
              aria-selected={id === active}
              className="terminal-tabs__select"
              onClick={() => setActive(id)}
            >
              {t("terminal.tabName", { n: index + 1 })}
            </button>
            <button type="button" className="terminal-tabs__close" aria-label={t("terminal.closeTab")} onClick={() => close(id)}>
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="terminal-tabs__add"
          aria-label={t("terminal.newTab")}
          title={atLimit ? t("terminal.limit") : t("terminal.newTab")}
          disabled={atLimit}
          onClick={add}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
      {atLimit && <p className="terminal__note">{t("terminal.limit")}</p>}
      {tabs.map((id) => (
        <div className="terminal-tabs__pane" key={id} hidden={id !== active}>
          <TerminalPanel cwd={cwd} />
        </div>
      ))}
    </div>
  );
}
