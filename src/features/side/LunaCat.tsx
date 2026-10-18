import { useEffect, useRef, useState } from "react";

interface LunaCatProps {
  /** Trabalhando: o gatinho anda. Parado: o gatinho dorme. */
  working: boolean;
}

/// Quadros em public/luna. Todos têm os pés na mesma linha e a mesma escala.
/// Andando: walk-00 a walk-15 (ciclo dos 4 quadros reais, com 3 intermediários entre cada par).
/// Dormindo: cat-04, olhos fechados.
const WALK_FRAMES = Array.from({ length: 16 }, (_, i) => `walk-${String(i).padStart(2, "0")}`);
const SLEEP_FRAME = "cat-04";
const WALK_INTERVAL_MS = 110;
/// Pausa irregular no começo de cada ciclo, para o passo não parecer um loop mecânico.
const PAUSE_MIN_MS = 1500;
const PAUSE_RANGE_MS = 2500;

/// Ações de uma vez: aceno quando o turno começa, beijo quando termina. Cada quadro dura ACTION_MS.
const WAVE_FRAMES = ["hello-00", "hello-01", "hello-02", "hello-01", "hello-00"];
const KISS_FRAMES = ["kiss-00", "kiss-01", "kiss-02", "kiss-03", "kiss-02", "kiss-03"];
/// Ociosas: uma pose de cada vez, de tempos em tempos, só quando a Luna não está trabalhando.
const IDLE_FRAMES = ["party-00", "gift-00", "thumbs-00", "wave-00", "wave-01"];
const ACTION_MS = 220;
const IDLE_HOLD_MS = 1600;
const IDLE_MIN_MS = 25000;
const IDLE_RANGE_MS = 15000;

interface Play {
  frames: string[];
  index: number;
}

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/// Gatinho lunar. Anda enquanto a Luna trabalha, acena quando um turno começa, dá beijo quando termina
/// e, parado, faz pequenas poses ociosas antes de voltar a dormir. Movimento reduzido: sem ações nem ciclo.
export function LunaCat({ working }: LunaCatProps) {
  const [step, setStep] = useState(0);
  const [play, setPlay] = useState<Play | null>(null);
  const [idle, setIdle] = useState<string | null>(null);
  const previous = useRef(working);

  // Início e fim do turno disparam ação. O primeiro render não dispara nada.
  useEffect(() => {
    const was = previous.current;
    previous.current = working;
    if (was === working || reducedMotion()) return;
    setIdle(null);
    setPlay({ frames: working ? WAVE_FRAMES : KISS_FRAMES, index: 0 });
  }, [working]);

  // Avança a ação de uma vez, quadro a quadro, e termina.
  useEffect(() => {
    if (!play) return;
    const timer = window.setTimeout(() => {
      setPlay((current) => (current && current.index + 1 < current.frames.length ? { ...current, index: current.index + 1 } : null));
    }, ACTION_MS);
    return () => window.clearTimeout(timer);
  }, [play]);

  // Andando: troca de quadro, com pausa sorteada no começo de cada ciclo.
  useEffect(() => {
    if (!working || play || reducedMotion()) return;
    const delay = step === 0 ? PAUSE_MIN_MS + Math.random() * PAUSE_RANGE_MS : WALK_INTERVAL_MS;
    const timer = window.setTimeout(() => setStep((s) => (s + 1) % WALK_FRAMES.length), delay);
    return () => window.clearTimeout(timer);
  }, [working, step, play]);

  // Parada e sem ação em curso: de tempos em tempos, uma pose ociosa curta.
  useEffect(() => {
    if (working || play || reducedMotion()) return;
    const timer = window.setTimeout(() => {
      setIdle(IDLE_FRAMES[Math.floor(Math.random() * IDLE_FRAMES.length)]);
    }, IDLE_MIN_MS + Math.random() * IDLE_RANGE_MS);
    return () => window.clearTimeout(timer);
  }, [working, play, idle]);

  // A pose ociosa some depois de um tempo.
  useEffect(() => {
    if (!idle) return;
    const timer = window.setTimeout(() => setIdle(null), IDLE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [idle]);

  const frame = play ? play.frames[play.index] : working ? WALK_FRAMES[step] : idle ?? SLEEP_FRAME;
  const label = working ? "Gatinho lunar andando" : "Gatinho lunar dormindo";

  return (
    <figure className={`luna-cat ${working ? "luna-cat--working" : "luna-cat--sleeping"}`}>
      <img src={`/luna/${frame}.png`} alt={label} draggable={false} />
      <span className="luna-cat__z luna-cat__z--first">z</span>
      <span className="luna-cat__z luna-cat__z--second">z</span>
    </figure>
  );
}
