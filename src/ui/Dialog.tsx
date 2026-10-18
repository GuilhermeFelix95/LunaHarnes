import { useEffect, type ReactNode } from "react";

interface DialogProps {
  title: string;
  /** Texto curto embaixo do título, para dizer o que a janela faz. */
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

/// Janela para formulários (criar ou editar algo). Escape e o botão Fechar a fecham.
/// Para perguntar antes de agir, use ConfirmDialog.
export function Dialog({ title, description, onClose, children }: DialogProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="dialog dialog--form popover">
        <header className="dialog__head">
          <div>
            <h3 id="dialog-title" className="dialog__title">
              {title}
            </h3>
            {description && <p className="dialog__desc">{description}</p>}
          </div>
          <button type="button" className="btn btn--ghost btn--sm" aria-label="Fechar" onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
