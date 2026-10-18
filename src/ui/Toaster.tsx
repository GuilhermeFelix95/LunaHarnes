import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { dismissToast, subscribeToasts, type ToastItem } from "./toast";

/// Pilha de avisos no canto inferior direito. Fica montada uma vez, no App.
export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setList), []);

  return (
    <div className="toaster">
      {list.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.kind}`} role="status">
          <div className="toast__text">
            <strong>{toast.title}</strong>
            {toast.body && <span>{toast.body}</span>}
          </div>
          <button type="button" className="toast__close" aria-label="Fechar aviso" onClick={() => dismissToast(toast.id)}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
