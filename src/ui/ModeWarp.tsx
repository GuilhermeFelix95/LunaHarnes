import { useEffect, useRef, useState } from "react";

export interface ModeWarpRun {
  /** Muda a cada troca, para uma nova troca reiniciar a animação mesmo na mesma direção. */
  id: number;
  direction: "in" | "out";
}

/// Efeito de portal que cobre a tela ao entrar no modo navegador e ao sair dele.
export function ModeWarp({ run }: { run: ModeWarpRun | null }) {
  const ref = useRef<HTMLDivElement>(null);
  // Id da última troca que já terminou de animar; a sobreposição some quando ela termina.
  const [finished, setFinished] = useState<number | null>(null);
  const runId = run?.id ?? null;

  useEffect(() => {
    const el = ref.current;
    if (!el || runId === null) return;
    const end = (e: Event) => {
      if (e.target === el) setFinished(runId);
    };
    el.addEventListener("animationend", end);
    return () => el.removeEventListener("animationend", end);
  }, [runId]);

  if (!run || run.id === finished) return null;

  return <div ref={ref} key={run.id} className={`mode-warp mode-warp--${run.direction}`} aria-hidden="true" />;
}
