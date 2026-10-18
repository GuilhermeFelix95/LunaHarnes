import { useEffect, useRef, useState } from "react";

interface LunaCatProps {
  /** Trabalhando: digita no notebook. Parado: dorme enrolado com "zZ". */
  working: boolean;
}

function hasWebGL(): boolean {
  return typeof window.WebGLRenderingContext !== "undefined";
}

/// Gatinho lunar 3D (three.js, carregado sob demanda). Sem WebGL, mostra o SVG.
export function LunaCat({ working }: LunaCatProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const workingRef = useRef(working);
  const [fallback, setFallback] = useState(() => !hasWebGL());

  useEffect(() => {
    workingRef.current = working;
  }, [working]);

  useEffect(() => {
    const host = hostRef.current;
    if (fallback || !host) return;
    let cancelled = false;
    let unmount: (() => void) | undefined;
    import("./catScene")
      .then(({ mountCatScene }) => {
        if (cancelled) return;
        try {
          unmount = mountCatScene(host, () => workingRef.current);
        } catch (e) {
          console.error("gatinho 3D: não foi possível montar a cena, usando o desenho simples", e);
          setFallback(true);
        }
      })
      .catch((e) => {
        console.error("gatinho 3D: falha ao carregar a cena", e);
        setFallback(true);
      });
    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [fallback]);

  if (fallback) return <LunaCatFallback working={working} />;

  return (
    <figure className={`luna-cat ${working ? "luna-cat--working" : "luna-cat--sleeping"}`}>
      <div
        ref={hostRef}
        className="luna-cat__canvas"
        role="img"
        aria-label={working ? "Gatinho lunar trabalhando" : "Gatinho lunar dormindo"}
      />
    </figure>
  );
}

/// Versão em SVG, usada quando o WebGL não está disponível.
export function LunaCatFallback({ working }: LunaCatProps) {
  return (
    <figure className={`luna-cat ${working ? "luna-cat--working" : "luna-cat--sleeping"}`}>
      <svg viewBox="0 0 160 110" role="img" aria-label={working ? "Gatinho lunar trabalhando" : "Gatinho lunar dormindo"}>
        <rect className="luna-cat__notebook" x="34" y="86" width="92" height="12" rx="3" />
        <rect className="luna-cat__screen" x="48" y="66" width="64" height="20" rx="2" />
        <path className="luna-cat__tail" d="M112 84 q26 -6 20 -26" />
        <ellipse className="luna-cat__body" cx="80" cy="74" rx="36" ry="20" />
        <polygon className="luna-cat__ear" points="62,38 62,14 78,30" />
        <polygon className="luna-cat__ear" points="98,38 98,14 82,30" />
        <circle className="luna-cat__head" cx="80" cy="44" r="20" />
        <path className="luna-cat__moon" d="M80 32 a6 6 0 1 0 0 12 a4.5 4.5 0 1 1 0 -12 z" />
        <g className="luna-cat__eyes">
          <circle cx="72" cy="48" r="2" />
          <circle cx="88" cy="48" r="2" />
        </g>
        <g className="luna-cat__closed-eyes">
          <path d="M68 49 q4 3 8 0" />
          <path d="M84 49 q4 3 8 0" />
        </g>
        <ellipse className="luna-cat__paw" cx="70" cy="86" rx="7" ry="4" />
        <ellipse className="luna-cat__paw" cx="90" cy="86" rx="7" ry="4" />
        <text className="luna-cat__z luna-cat__z--first" x="108" y="30">z</text>
        <text className="luna-cat__z luna-cat__z--second" x="118" y="20">Z</text>
      </svg>
    </figure>
  );
}
