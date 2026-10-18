import { useEffect, useRef, useState } from "react";

interface LunaCatProps {
  /** Trabalhando: o mascote balança e acena. Parado: dorme com a boca aberta. */
  working: boolean;
}

/// Duração da ação de uma vez: aceno quando o turno começa, pulinhos de alegria quando termina.
const ACTION_MS = 1200;
/// Caras engraçadas ociosas: uma de cada vez, de tempos em tempos, só quando a Luna não está ocupada.
const FACES = ["wink", "tongue", "surprised"] as const;
const FACE_MIN_MS = 7000;
const FACE_RANGE_MS = 7000;
const FACE_HOLD_MS = 1400;

type Action = "hello" | "happy";
type Face = (typeof FACES)[number];

/// Mascote da Luna em SVG, com cara de gato: orelhas, bigodes e rabo. Animação por CSS (components.css).
export function LunaCat({ working }: LunaCatProps) {
  const [action, setAction] = useState<Action | null>(null);
  const [face, setFace] = useState<Face | null>(null);
  const previous = useRef(working);

  // Início e fim do turno disparam uma ação. O primeiro render não dispara nada.
  useEffect(() => {
    const was = previous.current;
    previous.current = working;
    if (was === working) return;
    setFace(null);
    setAction(working ? "hello" : "happy");
  }, [working]);

  useEffect(() => {
    if (!action) return;
    const timer = window.setTimeout(() => setAction(null), ACTION_MS);
    return () => window.clearTimeout(timer);
  }, [action]);

  // Ociosa: de tempos em tempos, uma careta curta.
  useEffect(() => {
    if (working || action || face) return;
    const timer = window.setTimeout(
      () => setFace(FACES[Math.floor(Math.random() * FACES.length)]),
      FACE_MIN_MS + Math.random() * FACE_RANGE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [working, action, face]);

  useEffect(() => {
    if (!face) return;
    const timer = window.setTimeout(() => setFace(null), FACE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [face]);

  const className = [
    "luna-bot",
    working ? "luna-bot--working" : "luna-bot--sleeping",
    action ? `luna-bot--${action}` : "",
    face && !working && !action ? `luna-bot--face-${face}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <figure className={className}>
      <svg viewBox="0 0 130 112" role="img" aria-label={working ? "Mascote da Luna trabalhando" : "Mascote da Luna dormindo"}>
        <path className="luna-bot__ear" d="M26 42 L30 10 L54 30 Z" />
        <path className="luna-bot__ear" d="M94 42 L100 10 L76 30 Z" />
        <path className="luna-bot__tail" d="M102 92 Q124 90 120 68 Q118 58 126 52" />
        <rect className="luna-bot__leg" x="36" y="92" width="14" height="14" rx="7" />
        <rect className="luna-bot__leg" x="70" y="92" width="14" height="14" rx="7" />
        <rect className="luna-bot__arm luna-bot__arm--left" x="8" y="50" width="14" height="30" rx="7" />
        <rect className="luna-bot__arm luna-bot__arm--right" x="98" y="50" width="14" height="30" rx="7" />
        <rect className="luna-bot__body" x="20" y="22" width="80" height="72" rx="26" />
        <g className="luna-bot__whiskers">
          <path d="M16 66 L4 62 M16 72 L4 74 M104 66 L116 62 M104 72 L116 74" />
        </g>
        <ellipse className="luna-bot__eye luna-bot__eye--left" cx="46" cy="54" rx="7" ry="9" />
        <ellipse className="luna-bot__eye luna-bot__eye--right" cx="74" cy="54" rx="7" ry="9" />
        <path className="luna-bot__eye-closed" d="M39 58 Q46 63 53 58 M67 58 Q74 63 81 58" />
        <path className="luna-bot__eye-happy luna-bot__eye-happy--left" d="M39 58 Q46 50 53 58" />
        <path className="luna-bot__eye-happy luna-bot__eye-happy--right" d="M67 58 Q74 50 81 58" />
        <path className="luna-bot__nose" d="M56 64 L64 64 L60 69 Z" />
        <circle className="luna-bot__cheek" cx="36" cy="68" r="4" />
        <circle className="luna-bot__cheek" cx="84" cy="68" r="4" />
        <path className="luna-bot__mouth" d="M52 72 Q60 79 68 72" />
        <path className="luna-bot__tongue" d="M55 76 Q60 86 65 76 Z" />
        <ellipse className="luna-bot__mouth-open" cx="60" cy="78" rx="5" ry="5" />
      </svg>
      <span className="luna-bot__z luna-bot__z--first">z</span>
      <span className="luna-bot__z luna-bot__z--second">z</span>
    </figure>
  );
}
