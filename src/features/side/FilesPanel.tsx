import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import { listProjectDir } from "../../api";
import type { ProjectEntry } from "../../types";
import { t } from "../../i18n";

interface FilesPanelProps {
  /** Pasta do projeto da conversa. Trocar a pasta recomeça a árvore. */
  cwd: string;
  /** Arquivo aberto no editor do chat, marcado na árvore. */
  activePath?: string | null;
  /** Clicar num arquivo: o chat dá lugar ao editor desse arquivo. */
  onOpen?: (path: string) => void;
}

/// Arquivos do projeto: árvore que abre pastas sob demanda e filtro pelo nome.
/// Clicar num arquivo não lê nada aqui: quem abre é o editor no lugar do chat.
export function FilesPanel({ cwd, activePath, onOpen }: FilesPanelProps) {
  // Itens já lidos de cada pasta ("" = raiz). Pastas só são lidas quando abertas.
  const [children, setChildren] = useState<Record<string, ProjectEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setChildren({});
    setExpanded(new Set());
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
              aria-selected={activePath === entry.path}
              className={`files__row${activePath === entry.path ? " files__row--active" : ""}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => (entry.isDir ? void toggle(entry) : onOpen?.(entry.path))}
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
    <div className="files__list">
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
    </div>
  );
}
