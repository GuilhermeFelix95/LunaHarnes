import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, X } from "lucide-react";
import { listProjectDir, readProjectFile } from "../../api";
import type { ProjectEntry } from "../../types";
import { t } from "../../i18n";

interface FilesPanelProps {
  /** Pasta do projeto da conversa. Trocar a pasta recomeça a árvore. */
  cwd: string;
}

/// Arquivos do projeto como no Claude Desktop: árvore que abre pastas sob demanda, filtro pelo nome
/// e um visualizador de texto. Só leitura: nada aqui grava ou apaga arquivo.
export function FilesPanel({ cwd }: FilesPanelProps) {
  // Itens já lidos de cada pasta ("" = raiz). Pastas só são lidas quando abertas.
  const [children, setChildren] = useState<Record<string, ProjectEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [viewing, setViewing] = useState<{ path: string; content?: string; error?: string } | null>(null);

  useEffect(() => {
    setChildren({});
    setExpanded(new Set());
    setViewing(null);
    setError(null);
    void load("").catch((e) => setError(String(e)));
  }, [cwd]);

  async function load(path: string) {
    const items = await listProjectDir(cwd, path);
    setChildren((current) => ({ ...current, [path]: items }));
  }

  async function toggle(entry: ProjectEntry) {
    const open = expanded.has(entry.path);
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.delete(entry.path);
      else next.add(entry.path);
      return next;
    });
    if (!open && !children[entry.path]) {
      try {
        await load(entry.path);
      } catch (e) {
        setError(String(e));
      }
    }
  }

  async function open(entry: ProjectEntry) {
    setViewing({ path: entry.path });
    try {
      const content = await readProjectFile(cwd, entry.path);
      setViewing({ path: entry.path, content });
    } catch (e) {
      setViewing({ path: entry.path, error: String(e) });
    }
  }

  const needle = filter.trim().toLowerCase();
  // Com filtro, mostra só o que bate com o nome entre os itens já abertos.
  const matches = (entry: ProjectEntry) => !needle || entry.name.toLowerCase().includes(needle);

  function renderLevel(path: string, depth: number): ReactNode {
    const items = children[path] ?? [];
    return items
      .filter((entry) => matches(entry) || entry.isDir)
      .map((entry) => {
        const isOpen = expanded.has(entry.path);
        return (
          <li key={entry.path} role="none">
            <button
              type="button"
              role="treeitem"
              aria-expanded={entry.isDir ? isOpen : undefined}
              aria-selected={viewing?.path === entry.path}
              className={`files__row${viewing?.path === entry.path ? " files__row--active" : ""}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => (entry.isDir ? void toggle(entry) : void open(entry))}
              title={entry.path}
            >
              {entry.isDir ? (
                <>
                  {isOpen ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
                  {isOpen ? <FolderOpen size={14} aria-hidden="true" /> : <Folder size={14} aria-hidden="true" />}
                </>
              ) : (
                <>
                  <span className="files__spacer" aria-hidden="true" />
                  <File size={14} aria-hidden="true" />
                </>
              )}
              <span className="files__name">{entry.name}</span>
            </button>
            {entry.isDir && isOpen && <ul role="group" className="files__group">{renderLevel(entry.path, depth + 1)}</ul>}
          </li>
        );
      });
  }

  return (
    <div className="files">
      <input
        className="files__filter"
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t("files.filter")}
        aria-label={t("files.filter")}
      />
      {error && (
        <p role="alert" className="files__error">
          {t("files.loadError", { error })}
        </p>
      )}
      <ul role="tree" aria-label={t("side.tab.files")} className="files__tree">
        {renderLevel("", 0)}
      </ul>
      {!error && children[""] && children[""].length === 0 && <p className="files__empty">{t("files.empty")}</p>}

      {viewing && (
        <section className="files__viewer" aria-label={viewing.path}>
          <header className="files__viewer-head">
            <span className="files__viewer-path">{viewing.path}</span>
            <button type="button" className="files__viewer-close" aria-label={t("files.close")} onClick={() => setViewing(null)}>
              <X size={14} aria-hidden="true" />
            </button>
          </header>
          {viewing.error ? (
            <p role="alert" className="files__error">
              {viewing.error}
            </p>
          ) : viewing.content === undefined ? (
            <p className="files__empty">{t("files.reading")}</p>
          ) : (
            <pre className="files__code">{viewing.content}</pre>
          )}
        </section>
      )}
    </div>
  );
}
