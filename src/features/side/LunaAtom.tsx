import { useEffect, useRef, useState } from "react";

interface LunaAtomProps {
  /** Trabalhando: os elétrons correm rápido e o Átomo acena. Parado: dorme com os elétrons lentos. */
  working: boolean;
}

/// Duração da ação de uma vez: aceno quando o turno começa, pulinhos de alegria quando termina.
const ACTION_MS = 1200;
/// Caretas ociosas: uma de cada vez, de tempos em tempos, só quando a Luna não está ocupada.
const FACES = ["wink", "tongue", "surprised"] as const;
const FACE_MIN_MS = 7000;
const FACE_RANGE_MS = 7000;
const FACE_HOLD_MS = 1400;

type Action = "hello" | "happy";
type Face = (typeof FACES)[number];

/// Mesma geometria do ícone do app (public/luna/atom.png): corpo, olhos, sorriso, bracinhos e 3 órbitas.
/// Animação por CSS e SMIL (elétrons). Movimento reduzido desliga as animações em components.css.
export function LunaAtom({ working }: LunaAtomProps) {
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
    "luna-atom",
    working ? "luna-atom--working" : "luna-atom--sleeping",
    action ? `luna-atom--${action}` : "",
    face && !working && !action ? `luna-atom--face-${face}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Uma volta do elétron: mais curta trabalhando, mais longa dormindo.
  const orbitDur = working ? "1.6s" : "7s";
  const orbits = [0, 60, 120];
  const electronStart = [0.4, 2.7, 4.6];
  // Caminho de uma volta na elipse (330 x 110), começando em t = 0.
  const loop = "M842 512 A330 110 0 1 1 182 512 A330 110 0 1 1 842 512";

  return (
    <figure className={className}>
      <svg viewBox="0 0 1024 1024" role="img" aria-label={working ? "Mascote da Luna trabalhando" : "Mascote da Luna dormindo"}>
        {orbits.map((angle, i) => (
          <g key={angle} transform={`rotate(${angle} 512 512)`}>
            <ellipse className="luna-atom__orbit" cx="512" cy="512" rx="330" ry="110" />
            <circle className={`luna-atom__electron luna-atom__electron--${i}`} r="34" cx="842" cy="512">
              <animateMotion dur={orbitDur} repeatCount="indefinite" path={loop} begin={`-${electronStart[i]}s`} />
            </circle>
          </g>
        ))}
        <path className="luna-atom__arm luna-atom__arm--left" d="M330 560 L262 470" />
        <path className="luna-atom__arm luna-atom__arm--right" d="M694 560 L762 470" />
        <circle className="luna-atom__body" cx="512" cy="512" r="200" />
        <ellipse className="luna-atom__eye luna-atom__eye--left" cx="440" cy="480" rx="30" ry="40" />
        <ellipse className="luna-atom__eye luna-atom__eye--right" cx="584" cy="480" rx="30" ry="40" />
        <circle className="luna-atom__shine luna-atom__shine--left" cx="449" cy="466" r="10" />
        <circle className="luna-atom__shine luna-atom__shine--right" cx="593" cy="466" r="10" />
        <path className="luna-atom__eye-closed" d="M410 486 Q440 506 470 486 M554 486 Q584 506 614 486" />
        <path className="luna-atom__eye-happy luna-atom__eye-happy--left" d="M410 490 Q440 462 470 490" />
        <path className="luna-atom__eye-happy luna-atom__eye-happy--right" d="M554 490 Q584 462 614 490" />
        <circle className="luna-atom__cheek" cx="392" cy="540" r="26" />
        <circle className="luna-atom__cheek" cx="632" cy="540" r="26" />
        <path className="luna-atom__mouth" d="M456 556 Q512 600 568 556" />
        <path className="luna-atom__tongue" d="M496 580 Q512 610 528 580 Z" />
        <ellipse className="luna-atom__mouth-open" cx="512" cy="586" rx="18" ry="18" />
      </svg>
      <span className="luna-atom__z luna-atom__z--first">z</span>
      <span className="luna-atom__z luna-atom__z--second">z</span>
    </figure>
  );
}
