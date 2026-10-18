import { useEffect, useRef, useState } from "react";

interface LunaCatProps {
  /** Trabalhando: o mascote balança e acena. Parado: dorme com os olhos fechados. */
  working: boolean;
}

/// Duração da ação de uma vez: aceno quando o turno começa, pulinho quando termina.
const ACTION_MS = 1200;

type Action = "hello" | "happy";

/// Mascote da Luna em SVG: corpo arredondado, olhos que piscam, antena com brilho e braços.
/// Animação só por CSS (components.css). Movimento reduzido desliga as animações.
export function LunaCat({ working }: LunaCatProps) {
  const [action, setAction] = useState<Action | null>(null);
  const previous = useRef(working);

  // Início e fim do turno disparam uma ação. O primeiro render não dispara nada.
  useEffect(() => {
    const was = previous.current;
    previous.current = working;
    if (was === working) return;
    setAction(working ? "hello" : "happy");
  }, [working]);

  useEffect(() => {
    if (!action) return;
    const timer = window.setTimeout(() => setAction(null), ACTION_MS);
    return () => window.clearTimeout(timer);
  }, [action]);

  const className = [
    "luna-bot",
    working ? "luna-bot--working" : "luna-bot--sleeping",
    action ? `luna-bot--${action}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <figure className={className}>
      <svg viewBox="0 0 120 110" role="img" aria-label={working ? "Mascote da Luna trabalhando" : "Mascote da Luna dormindo"}>
        <line className="luna-bot__antenna" x1="60" y1="22" x2="60" y2="12" />
        <circle className="luna-bot__tip" cx="60" cy="8" r="6" />
        <rect className="luna-bot__leg" x="36" y="92" width="14" height="14" rx="7" />
        <rect className="luna-bot__leg" x="70" y="92" width="14" height="14" rx="7" />
        <rect className="luna-bot__arm luna-bot__arm--left" x="8" y="50" width="14" height="30" rx="7" />
        <rect className="luna-bot__arm luna-bot__arm--right" x="98" y="50" width="14" height="30" rx="7" />
        <rect className="luna-bot__body" x="20" y="22" width="80" height="72" rx="26" />
        <ellipse className="luna-bot__eye" cx="46" cy="54" rx="7" ry="9" />
        <ellipse className="luna-bot__eye" cx="74" cy="54" rx="7" ry="9" />
        <path className="luna-bot__eye-closed" d="M39 56 Q46 49 53 56" />
        <path className="luna-bot__eye-closed" d="M67 56 Q74 49 81 56" />
        <circle className="luna-bot__cheek" cx="36" cy="68" r="4" />
        <circle className="luna-bot__cheek" cx="84" cy="68" r="4" />
        <path className="luna-bot__mouth" d="M52 70 Q60 77 68 70" />
      </svg>
      <span className="luna-bot__z luna-bot__z--first">z</span>
      <span className="luna-bot__z luna-bot__z--second">z</span>
    </figure>
  );
}
