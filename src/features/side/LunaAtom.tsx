import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { t } from "../../i18n";
import { getThemeMedia, subscribeThemeMedia } from "../../plugins/themeRegistry";

interface LunaAtomProps {
  /** Versão pequena, para o cabeçalho do painel. */
  compact?: boolean;
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
export function LunaAtom({ working, compact = false }: LunaAtomProps) {
  const [action, setAction] = useState<Action | null>(null);
  const [face, setFace] = useState<Face | null>(null);
  const previous = useRef(working);
  // Ids dos gradientes precisam ser únicos: há um Átomo por conversa aberta, e o CSS resolvia `url(#…)` para o primeiro do documento.
  const uid = useId().replace(/:/g, "");
  const gid = (name: string) => `${uid}-${name}`;
  // Mascote do tema escolhido, quando ele traz um. Sem ele, a Luna é o átomo padrão.
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

  // Velocidade fixa: trocar o `dur` com a animação rodando faz o elétron pular de posição.
  const orbitDur = "1.6s";
  const orbits = [0, 60, 120];
  const electronStart = [0.4, 2.7, 4.6];
  // Caminho de uma volta na elipse (330 x 110), começando em t = 0.
  const loop = "M842 512 A330 110 0 1 1 182 512 A330 110 0 1 1 842 512";

  if (media.mascot) {
    return (
      <figure className={className}>
        <img className="luna-atom__image" src={media.mascot} alt={working ? t("luna.working") : t("luna.sleeping")} />
      </figure>
    );
  }

  return (
    <figure className={className}>
      <svg viewBox="0 0 1024 1024" role="img" aria-label={working ? t("luna.working") : t("luna.sleeping")}>
        <defs>
          {/* Luz vinda do canto superior esquerdo: o corpo ganha volume com degradê, aro escuro e brilho. */}
          <radialGradient id={gid("body")} cx="0.36" cy="0.3" r="0.85">
            <stop offset="0" stopColor="#e6eaff" />
            <stop offset="0.38" stopColor="#aab6f5" />
            <stop offset="0.78" stopColor="#6f7ed6" />
            <stop offset="1" stopColor="#4a56ad" />
          </radialGradient>
          <radialGradient id={gid("rim")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.72" stopColor="#1d2466" stopOpacity="0" />
            <stop offset="1" stopColor="#1d2466" stopOpacity="0.38" />
          </radialGradient>
          <radialGradient id={gid("ground")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#000" stopOpacity="0.34" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={gid("e0")} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#fff6dd" />
            <stop offset="0.5" stopColor="#ffd27a" />
            <stop offset="1" stopColor="#d9963c" />
          </radialGradient>
          <radialGradient id={gid("e1")} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#e6fff6" />
            <stop offset="0.5" stopColor="#7fd1b9" />
            <stop offset="1" stopColor="#3f9c84" />
          </radialGradient>
          <radialGradient id={gid("e2")} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#ffe9f3" />
            <stop offset="0.5" stopColor="#ff9ec7" />
            <stop offset="1" stopColor="#c95e90" />
          </radialGradient>
        </defs>
        {/* Sombra no chão: o Átomo flutua, então a sombra fica embaixo, desfocada. */}
        <ellipse className="luna-atom__ground" cx="512" cy="860" rx="210" ry="44" fill={`url(#${gid("ground")})`} />
        {orbits.map((angle) => (
          <g key={angle} transform={`rotate(${angle} 512 512)`}>
            <ellipse className="luna-atom__orbit" cx="512" cy="512" rx="330" ry="110" />
          </g>
        ))}
        <path className="luna-atom__arm luna-atom__arm--left" d="M330 560 L262 470" />
        <path className="luna-atom__arm luna-atom__arm--right" d="M694 560 L762 470" />
        <circle className="luna-atom__body" cx="512" cy="512" r="200" fill={`url(#${gid("body")})`} />
        <circle className="luna-atom__rim" cx="512" cy="512" r="200" fill={`url(#${gid("rim")})`} />
        <ellipse className="luna-atom__gloss" cx="430" cy="380" rx="62" ry="32" transform="rotate(-28 430 380)" />
        {/* Metade da frente de cada órbita passa por cima do corpo: dá a sensação de volta em volta do núcleo. */}
        {orbits.map((angle) => (
          <path key={angle} className="luna-atom__orbit-front" d="M182 512 A330 110 0 0 0 842 512" transform={`rotate(${angle} 512 512)`} />
        ))}
        {orbits.map((angle, i) => (
          <g key={angle} transform={`rotate(${angle} 512 512)`}>
            <circle className={`luna-atom__electron luna-atom__electron--${i}`} r="34" cx="842" cy="512" fill={`url(#${gid(`e${i}`)})`}>
              <animateMotion dur={orbitDur} repeatCount="indefinite" path={loop} begin={`-${electronStart[i]}s`} />
            </circle>
          </g>
        ))}
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
