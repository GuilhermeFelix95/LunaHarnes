import { useState } from "react";
import { Folder, GitBranch } from "lucide-react";
import { folderName } from "../sidebar/groupByProject";
import { usePopover } from "../../ui/usePopover";
import { t } from "../../i18n";

interface WorkspaceChipProps {
  cwd: string;
  /** Pastas usadas antes, sem repetir a atual. */
  recent: string[];
  /** Pasta do app para conversas sem projeto ("Trabalhar sem pasta"). */
  freeFolder?: string;
  disabled?: boolean;
  onPick: (path: string) => void;
  onBrowse: () => void;
  /** Branches locais da pasta (vazio quando não é repositório git). */
  branches?: string[];
  /** Branch em que a pasta está agora. Aparece ao lado da pasta; ausente = não é repositório, ou HEAD solta. */
  currentBranch?: string | null;
  /** Trabalha numa branch: cria a worktree dela. `isNew` cria a branch a partir da atual. */
  onPickBranch?: (branch: string, isNew: boolean) => void;
  /** Chamado ao abrir o menu de branch, para recarregar a lista antes de mostrá-la. */
  onOpenBranches?: () => void;
}

/// Mostra a pasta em que o agente trabalha, no rodapé do composer. Abre um menu para trocar.
export function WorkspaceChip({ cwd, recent, freeFolder, disabled, onPick, onBrowse, branches = [], currentBranch, onPickBranch, onOpenBranches }: WorkspaceChipProps) {
  const { open, setOpen, root } = usePopover();
  const branchPopover = usePopover();
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
        {folderName(cwd) || t("workspace.pick")}
      </button>

      {open && (
        <div className="workspace-chip__menu" role="menu" aria-label={t("workspace.menuAria")}>
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
            {t("workspace.switch")}
          </button>
          {freeFolder && freeFolder !== cwd && (
            <button
              type="button"
              role="menuitem"
              className="workspace-chip__item"
              onClick={() => {
                setOpen(false);
                onPick(freeFolder);
              }}
            >
              {t("workspace.free")}
            </button>
          )}
          {others.length > 0 && <p className="workspace-chip__label">{t("workspace.recent")}</p>}
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

      {/* Repositório git: a branch atual aparece ao lado da pasta, e o menu lista as outras. Trabalhar numa delas é um clique. */}
      {(branches.length > 0 || currentBranch) && onPickBranch && (
        <div className="workspace-chip" ref={branchPopover.root}>
          <button
            type="button"
            className="workspace-chip__trigger"
            title={t("workspace.branchLabel")}
            aria-haspopup="menu"
            aria-expanded={branchPopover.open}
            disabled={disabled}
            onClick={() => {
              if (!branchPopover.open) onOpenBranches?.();
              branchPopover.setOpen((on) => !on);
            }}
          >
            <GitBranch size={13} aria-hidden="true" />
            {currentBranch ?? t("workspace.branchesButton", { count: branches.length })}
          </button>

          {branchPopover.open && (
            <div className="workspace-chip__menu" role="menu" aria-label={t("workspace.branchLabel")}>
              <p className="workspace-chip__label">{t("workspace.branchLabel")}</p>
              {branches.map((branch) => (
                <button
                  key={branch}
                  type="button"
                  role="menuitem"
                  className={`workspace-chip__item${branch === currentBranch ? " workspace-chip__item--current" : ""}`}
                  aria-current={branch === currentBranch ? "true" : undefined}
                  onClick={() => {
                    branchPopover.setOpen(false);
                    // A branch atual já é a pasta aberta: não cria outra worktree.
                    if (branch !== currentBranch) onPickBranch(branch, false);
                  }}
                >
                  {branch === currentBranch ? t("workspace.branchCurrent", { branch }) : branch}
                </button>
              ))}
              <form
                className="workspace-chip__new"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newBranch.trim();
                  if (!name) return;
                  setNewBranch("");
                  branchPopover.setOpen(false);
                  onPickBranch(name, true);
                }}
              >
                <input
                  aria-label={t("workspace.newBranchAria")}
                  placeholder="nova-branch"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                />
                <button type="submit" disabled={!newBranch.trim()}>
                  {t("workspace.create")}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
