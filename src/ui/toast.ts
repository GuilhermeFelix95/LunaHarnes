/// Avisos na tela (pop-up no canto). Ficam numa lista própria, para qualquer parte do app avisar sem passar props.
export const TOAST_KEY = "luna.toast";
const TOAST_MS = 5000;

export type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

/// Ligado por padrão. "0" guarda o desligado.
export function toastsEnabled(): boolean {
  try {
    return localStorage.getItem(TOAST_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setToastsEnabled(on: boolean) {
  try {
    localStorage.setItem(TOAST_KEY, on ? "1" : "0");
  } catch {
    // Sem armazenamento, a escolha vale só nesta sessão.
  }
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<(list: ToastItem[]) => void>();

function emit() {
  for (const listener of listeners) listener(items);
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

/// Mostra um aviso e o tira sozinho depois de alguns segundos. Com o aviso desligado, não faz nada.
export function showToast(toast: Omit<ToastItem, "id">) {
  if (!toastsEnabled()) return;
  const id = nextId++;
  items = [...items, { ...toast, id }];
  emit();
  setTimeout(() => dismissToast(id), TOAST_MS);
}

export function subscribeToasts(listener: (list: ToastItem[]) => void): () => void {
  listeners.add(listener);
  listener(items);
  return () => {
    listeners.delete(listener);
  };
}
