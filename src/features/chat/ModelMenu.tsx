import { useEffect, useRef, useState } from "react";
import type { ModelOption } from "../../types";

interface ModelMenuProps {
  models: ModelOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

/// Seletor de modelo com nome e descrição, no estilo do Claude Desktop.
export function ModelMenu({ models, value, onChange, disabled }: ModelMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = models.find((m) => m.id === value);

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
          {models.map((m) => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={value === m.id}
              className="model-menu__item"
              onClick={() => choose(m.id)}
            >
              <span className="model-menu__name">{m.label}</span>
              {m.description && <span className="model-menu__desc">{m.description}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
