import { useEffect, useState } from "react";
import { discardChange, getChanges, getFileDiff } from "../../api";
import type { ChangedFile, Changes } from "../../types";
import { EmptyState } from "../../ui/EmptyState";
import { t, type MessageKey } from "../../i18n";

interface ChangesPanelProps {
  cwd: string;
  /** Muda ao fim de cada turno, para recarregar a lista. */
  version: number;
}

const STATUS_KEYS: Record<string, MessageKey> = {
  added: "changes.status.added",
  modified: "changes.status.modified",
  deleted: "changes.status.deleted",
  renamed: "changes.status.renamed",
  untracked: "changes.status.untracked",
};

/// Painel à direita com os arquivos que o agente mexeu, pelo git. Clicar num arquivo mostra o diff.
export function ChangesPanel({ cwd, version }: ChangesPanelProps) {
  const [changes, setChanges] = useState<Changes | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>("");
  // Arquivo que espera a segunda confirmação de "Desfazer".
  const [undoing, setUndoing] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    getChanges(cwd)
      .then((result) => {
        if (active) {
          setChanges(result);
          setError(undefined);
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [cwd, version, reload]);

  /// Clicar no arquivo aberto fecha o diff; clicar em outro troca.
  async function open(path: string) {
    if (selected === path) {
      setSelected(null);
      setDiff("");
      return;
    }
    setSelected(path);
    try {
      setDiff(await getFileDiff(cwd, path));
    } catch (e) {
      setDiff(String(e));
    }
  }

  /// Primeiro clique pede confirmação; o segundo desfaz. Arquivo novo é apagado, então a confirmação importa.
  async function undo(file: { path: string; status: ChangedFile["status"] }) {
    if (undoing !== file.path) {
      setUndoing(file.path);
      return;
    }
    try {
      await discardChange(cwd, file.path, file.status);
      setUndoing(null);
      if (selected === file.path) {
        setSelected(null);
        setDiff("");
      }
      setReload((n) => n + 1);
    } catch (e) {
      setUndoing(null);
      setError(String(e));
    }
  }

  if (error) {
    return (
      <aside className="changes" aria-label={t("changes.title")}>
        <p role="alert" className="changes__note">{error}</p>
      </aside>
    );
  }

  if (!changes) return <aside className="changes" aria-label={t("changes.title")} />;

  if (!changes.isRepo) {
    return (
      <aside className="changes" aria-label={t("changes.title")}>
        <p className="changes__note">{t("changes.notRepo")}</p>
      </aside>
    );
  }

  return (
    <aside className="changes" aria-label={t("changes.title")}>
      <header className="changes__head">
        <h2>{t("changes.title")}</h2>
        <span className="changes__count">{changes.files.length}</span>
      </header>

      {changes.files.length === 0 && <EmptyState>{t("changes.empty")}</EmptyState>}

      <ul className="changes__list">
        {changes.files.map((file) => (
          <li key={file.path}>
            <button
              type="button"
              className={`changes__item${selected === file.path ? " is-selected" : ""}`}
              aria-pressed={selected === file.path}
              onClick={() => void open(file.path)}
              title={`${file.path} · ${t(STATUS_KEYS[file.status])}`}
            >
              <span className="changes__path">{file.path}</span>
              <span className="changes__stat">
                {file.additions !== null && <span className="diff-add">+{file.additions}</span>}
                {file.deletions !== null && <span className="diff-del">−{file.deletions}</span>}
              </span>
            </button>
            <button
              type="button"
              className={`changes__undo${undoing === file.path ? " is-confirming" : ""}`}
              aria-label={t("changes.undoAria", { path: file.path })}
              disabled={file.status === "renamed"}
              title={file.status === "renamed" ? t("changes.renameTitle") : t("changes.undoTitle")}
              onClick={() => void undo(file)}
            >
              {undoing === file.path ? t("changes.confirm") : t("changes.undo")}
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <pre className="changes__diff" aria-label={t("changes.diffAria", { path: selected })}>
          {diff.split("\n").map((line, i) => (
            <span key={i} className={lineClass(line)}>
              {line}
              {"\n"}
            </span>
          ))}
        </pre>
      )}
    </aside>
  );
}

function lineClass(line: string): string {
  if (line.startsWith("+") && !line.startsWith("+++")) return "diff-line diff-line--add";
  if (line.startsWith("-") && !line.startsWith("---")) return "diff-line diff-line--del";
  if (line.startsWith("@@")) return "diff-line diff-line--hunk";
  return "diff-line";
}
