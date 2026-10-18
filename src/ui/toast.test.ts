import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, setToastsEnabled, showToast, subscribeToasts, TOAST_KEY, toastsEnabled, type ToastItem } from "./toast";

describe("avisos na tela", () => {
  let seen: ToastItem[] = [];
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    seen = [];
    unsubscribe = subscribeToasts((list) => (seen = list));
  });

  afterEach(() => {
    unsubscribe();
    vi.useRealTimers();
  });

  it("mostra o aviso e tira sozinho depois de 5 s", () => {
    showToast({ kind: "success", title: "Resposta pronta" });
    expect(seen.map((t) => t.title)).toEqual(["Resposta pronta"]);

    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([]);
  });

  it("o X tira o aviso na hora", () => {
    showToast({ kind: "error", title: "Erro na resposta" });
    dismissToast(seen[0].id);

    expect(seen).toEqual([]);
  });

  it("com o aviso desligado, nada aparece", () => {
    setToastsEnabled(false);
    expect(localStorage.getItem(TOAST_KEY)).toBe("0");

    showToast({ kind: "info", title: "Oi" });

    expect(seen).toEqual([]);
    expect(toastsEnabled()).toBe(false);
  });

  it("ligado por padrão", () => {
    expect(toastsEnabled()).toBe(true);
  });
});
