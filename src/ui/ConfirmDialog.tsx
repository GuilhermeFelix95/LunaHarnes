import { useEffect, useRef, type ReactNode } from "react";

interface ConfirmDialogProps {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  /** Ação destrutiva: o botão de confirmar fica em vermelho. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/// Diálogo de confirmação no visual do app. Substitui o window.confirm.
/// O foco começa em Cancelar, para que Enter não confirme uma ação destrutiva sem querer.
export function ConfirmDialog({ title, body, confirmLabel, danger, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancel.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="dialog-backdrop">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="dialog popover">
        <h3 id="confirm-title" className="dialog__title">
          {title}
        </h3>
        {body && <div className="dialog__body">{body}</div>}
        <div className="dialog__actions">
          <button ref={cancel} type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={danger ? "btn btn--danger" : "btn btn--primary"} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
