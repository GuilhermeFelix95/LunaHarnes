import { useEffect, useState } from "react";

interface LunaCatProps {
  /** Trabalhando: o gatinho anda. Parado: o gatinho dorme. */
  working: boolean;
}

/// Quadros em public/luna. Todos têm os pés na mesma linha.
/// Andando: walk-00 a walk-15, o ciclo dos 4 quadros reais com 3 intermediários entre cada par (gerados de cat-01, 05, 08 e 06).
/// Dormindo: cat-04, pose de olhos fechados.
const WALK_FRAMES = Array.from({ length: 16 }, (_, i) => `walk-${String(i).padStart(2, "0")}`);
const SLEEP_FRAME = "cat-04";
const WALK_INTERVAL_MS = 110;
/// Pausa irregular no começo de cada ciclo, para o passo não parecer um loop mecânico.
const PAUSE_MIN_MS = 1500;
const PAUSE_RANGE_MS = 2500;

/// Gatinho lunar. Troca de quadro por timer; no início do ciclo, uma pausa sorteada antes de andar de novo.
export function LunaCat({ working }: LunaCatProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!working) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;
    const delay = step === 0 ? PAUSE_MIN_MS + Math.random() * PAUSE_RANGE_MS : WALK_INTERVAL_MS;
    const timer = window.setTimeout(() => setStep((s) => (s + 1) % WALK_FRAMES.length), delay);
    return () => window.clearTimeout(timer);
  }, [working, step]);

  const frame = working ? WALK_FRAMES[step] : SLEEP_FRAME;
  const label = working ? "Gatinho lunar andando" : "Gatinho lunar dormindo";

  return (
    <figure className={`luna-cat ${working ? "luna-cat--working" : "luna-cat--sleeping"}`}>
      <img src={`/luna/${frame}.png`} alt={label} draggable={false} />
      <span className="luna-cat__z luna-cat__z--first">z</span>
      <span className="luna-cat__z luna-cat__z--second">z</span>
    </figure>
  );
}
