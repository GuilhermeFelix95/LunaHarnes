/// Agrupa atualizações: vários pedidos no mesmo quadro de tela viram uma única execução.
export interface FrameBatch {
  /** Pede uma execução no próximo quadro. Pedidos repetidos antes do quadro não se somam. */
  schedule(): void;
  /** Executa agora o que estiver pendente. Sem pendência, não faz nada. */
  flush(): void;
}

export function createFrameBatch(run: () => void): FrameBatch {
  let pending = false;

  function flush() {
    if (!pending) return;
    pending = false;
    run();
  }

  return {
    schedule() {
      if (pending) return;
      pending = true;
      requestFrame(flush);
    },
    flush,
  };
}

/// Quadro do navegador; sem ele, um intervalo de 16 ms (o equivalente a 60 quadros por segundo).
function requestFrame(callback: () => void) {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => callback());
  else setTimeout(callback, 16);
}
