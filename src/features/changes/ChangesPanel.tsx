import { useEffect, useState } from "react";
import { getChanges, getFileDiff } from "../../api";
import type { Changes } from "../../types";

interface ChangesPanelProps {
  cwd: string;
  /** Muda ao fim de cada turno, para recarregar a lista. */
  version: number;
}

const STATUS_LABEL: Record<string, string> = {
  added: "Novo",
  modified: "Alterado",
  deleted: "Removido",
  renamed: "Renomeado",
  untracked: "Novo (não rastreado)",
};

/// Painel à direita com os arquivos que o agente mexeu, pelo git. Clicar num arquivo mostra o diff.
export function ChangesPanel({ cwd, version }: ChangesPanelProps) {
  const [changes, setChanges] = useState<Changes | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>("");

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
  }, [cwd, version]);

  async function open(path: string) {
    setSelected(path);
    try {
      setDiff(await getFileDiff(cwd, path));
    } catch (e) {
      setDiff(String(e));
    }
  }

  if (error) {
    return (
      <aside className="changes" aria-label="Alterações">
        <p role="alert" className="changes__note">{error}</p>
      </aside>
    );
  }

  if (!changes) return <aside className="changes" aria-label="Alterações" />;

  if (!changes.isRepo) {
    return (
      <aside className="changes" aria-label="Alterações">
        <p className="changes__note">
          Esta pasta não é um repositório git, então não dá para listar as alterações.
        </p>
      </aside>
    );
  }

  return (
    <aside className="changes" aria-label="Alterações">
      <header className="changes__head">
        <h2>Alterações</h2>
        <span className="changes__count">{changes.files.length}</span>
      </header>

      {changes.files.length === 0 && <p className="changes__note">Nenhum arquivo alterado.</p>}

      <ul className="changes__list">
        {changes.files.map((file) => (
          <li key={file.path}>
            <button
              type="button"
              className={`changes__item${selected === file.path ? " is-selected" : ""}`}
              onClick={() => void open(file.path)}
              title={`${file.path} · ${STATUS_LABEL[file.status]}`}
            >
              <span className="changes__path">{file.path}</span>
              <span className="changes__stat">
                {file.additions !== null && <span className="diff-add">+{file.additions}</span>}
                {file.deletions !== null && <span className="diff-del">−{file.deletions}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <pre className="changes__diff" aria-label={`Diff de ${selected}`}>
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
