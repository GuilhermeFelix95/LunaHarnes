import { useEffect, useRef, useState } from "react";
import { folderName } from "../sidebar/groupByProject";

interface WorkspaceChipProps {
  cwd: string;
  /** Pastas usadas antes, sem repetir a atual. */
  recent: string[];
  disabled?: boolean;
  onPick: (path: string) => void;
  onBrowse: () => void;
}

/// Mostra a pasta em que o agente trabalha, no rodapé do composer. Abre um menu para trocar.
export function WorkspaceChip({ cwd, recent, disabled, onPick, onBrowse }: WorkspaceChipProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const others = recent.filter((path) => path !== cwd);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="workspace-chip" ref={root}>
      <button
        type="button"
        className="workspace-chip__trigger"
        title={cwd}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((on) => !on)}
      >
        <span aria-hidden="true">▢</span>
        {folderName(cwd) || "Escolher pasta"}
      </button>

      {open && (
        <div className="workspace-chip__menu" role="menu" aria-label="Pasta de trabalho">
          <p className="workspace-chip__path" title={cwd}>{cwd}</p>
          <button
            type="button"
            role="menuitem"
            className="workspace-chip__item"
            onClick={() => {
              setOpen(false);
              onBrowse();
            }}
          >
            Trocar pasta…
          </button>
          {others.length > 0 && <p className="workspace-chip__label">Recentes</p>}
          {others.map((path) => (
            <button
              key={path}
              type="button"
              role="menuitem"
              className="workspace-chip__item"
              title={path}
              onClick={() => {
                setOpen(false);
                onPick(path);
              }}
            >
              {folderName(path)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
