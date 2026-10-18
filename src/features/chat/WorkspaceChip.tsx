import { useState } from "react";
import { Folder } from "lucide-react";
import { folderName } from "../sidebar/groupByProject";
import { usePopover } from "../../ui/usePopover";

interface WorkspaceChipProps {
  cwd: string;
  /** Pastas usadas antes, sem repetir a atual. */
  recent: string[];
  disabled?: boolean;
  onPick: (path: string) => void;
  onBrowse: () => void;
  /** Branches locais da pasta (vazio quando não é repositório git). */
  branches?: string[];
  /** Trabalha numa branch: cria a worktree dela. `isNew` cria a branch a partir da atual. */
  onPickBranch?: (branch: string, isNew: boolean) => void;
}

/// Mostra a pasta em que o agente trabalha, no rodapé do composer. Abre um menu para trocar.
export function WorkspaceChip({ cwd, recent, disabled, onPick, onBrowse, branches = [], onPickBranch }: WorkspaceChipProps) {
  const { open, setOpen, root } = usePopover();
  const [newBranch, setNewBranch] = useState("");
  const others = recent.filter((path) => path !== cwd);

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
        <Folder size={13} aria-hidden="true" />
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
          {branches.length > 0 && onPickBranch && (
            <>
              <p className="workspace-chip__label">Trabalhar numa branch</p>
              {branches.map((branch) => (
                <button
                  key={branch}
                  type="button"
                  role="menuitem"
                  className="workspace-chip__item"
                  onClick={() => {
                    setOpen(false);
                    onPickBranch(branch, false);
                  }}
                >
                  {branch}
                </button>
              ))}
              <form
                className="workspace-chip__new"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newBranch.trim();
                  if (!name) return;
                  setNewBranch("");
                  setOpen(false);
                  onPickBranch(name, true);
                }}
              >
                <input
                  aria-label="Nova branch"
                  placeholder="nova-branch"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                />
                <button type="submit" disabled={!newBranch.trim()}>
                  Criar
                </button>
              </form>
            </>
          )}
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
