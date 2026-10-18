import { useEffect, useRef, useState } from "react";
import type { ModelOption } from "../../types";

interface ModelMenuProps {
  models: ModelOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

/// Acima desta quantidade o seletor mostra um campo de busca.
const SEARCH_FROM = 8;

/// Seletor de modelo com nome e descrição, no estilo do Claude Desktop.
export function ModelMenu({ models, value, onChange, disabled }: ModelMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const current = models.find((m) => m.id === value);
  const term = query.trim().toLowerCase();
  const shown = term
    ? models.filter((m) => m.id.toLowerCase().includes(term) || m.label.toLowerCase().includes(term))
    : models;

  // Fecha ao clicar fora ou apertar Esc.
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

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="model-menu" ref={root}>
      <button
        type="button"
        className="model-menu__trigger"
        aria-label="Modelo"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled || models.length === 0}
        onClick={() => setOpen((on) => !on)}
      >
        {current?.label ?? "Sem modelos"}
      </button>

      {open && (
        <div className="model-menu__panel" role="listbox" aria-label="Modelos">
          {models.length > SEARCH_FROM && (
            <input
              type="search"
              className="model-menu__search"
              aria-label="Buscar modelo"
              placeholder="Buscar modelo"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          {shown.map((m) => (
            <button
              key={m.id}
              type="button"
              role="option"
              title={m.id}
              aria-selected={value === m.id}
              className="model-menu__item"
              onClick={() => choose(m.id)}
            >
              <span className="model-menu__name">{m.label}</span>
              {m.contextWindow ? (
                <span className="model-menu__desc">{formatContext(m.contextWindow)} de contexto</span>
              ) : (
                m.description && <span className="model-menu__desc">{m.description}</span>
              )}
            </button>
          ))}
          {shown.length === 0 && <p className="model-menu__empty">Nenhum modelo com “{query.trim()}”.</p>}
        </div>
      )}
    </div>
  );
}

/// Janela de contexto em texto curto: 128000 -> "128k", 1048576 -> "1M".
function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${Math.round(tokens / 100_000) / 10}M`;
  return `${Math.round(tokens / 1000)}k`;
}
