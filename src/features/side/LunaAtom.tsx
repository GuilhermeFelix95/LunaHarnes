import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { t } from "../../i18n";
import { getThemeMedia, subscribeThemeMedia } from "../../plugins/themeRegistry";

interface LunaAtomProps {
  /** Versão pequena, para o cabeçalho do painel. */
  compact?: boolean;
  /** Trabalhando: o robô balança e a antena pisca rápido. Parado: dorme de olhos fechados e flutua. */
  working: boolean;
}

/// Duração da ação de uma vez: aceno quando o turno começa, pulinhos de alegria quando termina.
const ACTION_MS = 1200;
/// Caretas ociosas: uma de cada vez, de tempos em tempos, só quando a Luna não está ocupada.
const FACES = ["wink", "surprised"] as const;
const FACE_MIN_MS = 7000;
const FACE_RANGE_MS = 7000;
const FACE_HOLD_MS = 1400;

type Action = "hello" | "happy";
type Face = (typeof FACES)[number];

/// Mesmo desenho do ícone do app (public/luna/logo.svg): robô de visor escuro, antena, orelhas e a lua.
/// Animação por CSS (components.css). Movimento reduzido desliga as animações.
export function LunaAtom({ working, compact = false }: LunaAtomProps) {
  const [action, setAction] = useState<Action | null>(null);
  const [face, setFace] = useState<Face | null>(null);
  const previous = useRef(working);
  // Mascote do tema escolhido, quando ele traz um. Sem ele, a Luna é o robô do ícone.
  const media = useSyncExternalStore(subscribeThemeMedia, getThemeMedia);

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
    compact ? "luna-atom--compact" : "",
    action ? `luna-atom--${action}` : "",
    face && !working && !action ? `luna-atom--face-${face}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const label = working ? t("luna.working") : t("luna.sleeping");

  if (media.mascot) {
    return (
      <figure className={className}>
        <img className="luna-atom__image" src={media.mascot} alt={label} />
      </figure>
    );
  }

  return (
    <figure className={className}>
      <svg viewBox="0 0 512 512" role="img" aria-label={label}>
        <rect className="luna-atom__tile" x="0" y="0" width="512" height="512" rx="112" fill="#0f1a26" />
        <path className="luna-atom__moon" d="M412 58 A36 36 0 1 0 446 104 A29 29 0 1 1 412 58 Z" fill="#f2c26b" />
        <line className="luna-atom__antenna" x1="256" y1="132" x2="256" y2="96" stroke="#9cc9e6" strokeWidth="14" strokeLinecap="round" />
        <circle className="luna-atom__antenna-ball" cx="256" cy="84" r="20" fill="#7fd3ff" />
        <rect className="luna-atom__ear" x="96" y="222" width="28" height="72" rx="14" fill="#2a6f97" />
        <rect className="luna-atom__ear" x="388" y="222" width="28" height="72" rx="14" fill="#2a6f97" />
        <rect className="luna-atom__head" x="116" y="132" width="280" height="252" rx="90" fill="#eef4f8" />
        <rect className="luna-atom__visor" x="144" y="184" width="224" height="124" rx="56" fill="#13263a" />
        <g className="luna-atom__eye luna-atom__eye--left">
          <circle cx="206" cy="246" r="34" fill="#7fd3ff" opacity="0.25" />
          <circle cx="206" cy="246" r="22" fill="#7fd3ff" />
        </g>
        <g className="luna-atom__eye luna-atom__eye--right">
          <circle cx="306" cy="246" r="34" fill="#7fd3ff" opacity="0.25" />
          <circle cx="306" cy="246" r="22" fill="#7fd3ff" />
        </g>
        {/* Olhos fechados (dormindo e piscada de careta) e felizes (^^ no fim do turno). */}
        <path className="luna-atom__eye-closed luna-atom__eye-closed--left" d="M176 246 Q206 270 236 246" fill="none" stroke="#7fd3ff" strokeWidth="14" strokeLinecap="round" />
        <path className="luna-atom__eye-closed luna-atom__eye-closed--right" d="M276 246 Q306 270 336 246" fill="none" stroke="#7fd3ff" strokeWidth="14" strokeLinecap="round" />
        <path className="luna-atom__eye-happy" d="M176 254 Q206 222 236 254 M276 254 Q306 222 336 254" fill="none" stroke="#7fd3ff" strokeWidth="14" strokeLinecap="round" />
        <path className="luna-atom__mouth" d="M212 340 Q256 368 300 340" fill="none" stroke="#13263a" strokeWidth="14" strokeLinecap="round" />
        <path className="luna-atom__mouth-flat" d="M226 344 H286" fill="none" stroke="#13263a" strokeWidth="14" strokeLinecap="round" />
        <ellipse className="luna-atom__mouth-open" cx="256" cy="346" rx="14" ry="18" fill="#13263a" />
      </svg>
      <span className="luna-atom__z luna-atom__z--first">z</span>
      <span className="luna-atom__z luna-atom__z--second">z</span>
    </figure>
  );
}
