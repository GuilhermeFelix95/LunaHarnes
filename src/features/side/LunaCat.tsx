import { useEffect, useState } from "react";

interface LunaCatProps {
  /** Trabalhando: o gatinho anda. Parado: o gatinho dorme. */
  working: boolean;
}

/// Quadros do spritesheet do gatinho, em public/luna. Todos têm os pés na mesma linha.
/// Andando: ciclo de poses. Dormindo: pose de olhos fechados.
const WALK_FRAMES = ["cat-01", "cat-05", "cat-08", "cat-06"];
const SLEEP_FRAME = "cat-04";
const WALK_INTERVAL_MS = 180;

/// Gatinho lunar. Trocar de quadro em intervalo fixo é mais simples e previsível que animar partes do desenho.
export function LunaCat({ working }: LunaCatProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!working) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;
    const timer = window.setInterval(() => setStep((s) => (s + 1) % WALK_FRAMES.length), WALK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [working]);

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
