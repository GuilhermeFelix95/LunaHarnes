import { useId } from "react";

interface LunaCatProps {
  /** Trabalhando: digita no notebook. Parado: dorme enrolado com "zZ". */
  working: boolean;
}

/// Gatinho lunar em SVG vetorial, animado com CSS (piscar, respirar, cauda, digitação e zZ).
/// Sem WebGL e sem biblioteca de animação: o desenho fica no próprio código e segue o tema pelas cores fixas do gatinho.
export function LunaCat({ working }: LunaCatProps) {
  const id = useId().replace(/:/g, "");
  const label = working ? "Gatinho lunar trabalhando" : "Gatinho lunar dormindo";
  const fur = `${id}-fur`;
  const blush = `${id}-blush`;
  const shadow = `${id}-shadow`;
  const screen = `${id}-screen`;

  return (
    <figure className={`luna-cat ${working ? "luna-cat--working" : "luna-cat--sleeping"}`}>
      <svg viewBox="0 0 220 200" role="img" aria-label={label}>
        <defs>
          <linearGradient id={fur} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c4b2ff" />
            <stop offset="1" stopColor="#8b6ef0" />
          </linearGradient>
          <radialGradient id={blush}>
            <stop offset="0" stopColor="#ff9fbf" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ff9fbf" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={shadow}>
            <stop offset="0" stopColor="#000" stopOpacity="0.28" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={screen} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a2746" />
            <stop offset="1" stopColor="#171629" />
          </linearGradient>
        </defs>

        {/* Sombra no chão */}
        <ellipse cx="110" cy="186" rx="78" ry="11" fill={`url(#${shadow})`} />

        {/* Cauda, enrolada para a direita */}
        <path className="luna-cat__tail" d="M150 168 C 192 172 200 128 180 114" fill="none" stroke="#8b6ef0" strokeWidth="14" strokeLinecap="round" />

        {/* Corpo sentado e barriga creme */}
        <g className="luna-cat__body">
          <ellipse cx="110" cy="140" rx="54" ry="46" fill={`url(#${fur})`} />
          <ellipse cx="110" cy="150" rx="30" ry="26" fill="#f7f2ff" />
        </g>

        {/* Notebook: base, tela e linhas de código */}
        <g className="luna-cat__laptop">
          <rect x="44" y="164" width="132" height="13" rx="6.5" fill="#d9d3f2" />
          <rect x="66" y="124" width="88" height="46" rx="8" fill="#3a3450" />
          <rect x="72" y="130" width="76" height="34" rx="5" fill={`url(#${screen})`} />
          <g className="luna-cat__code">
            <rect x="78" y="136" width="36" height="4" rx="2" fill="#a78bfa" />
            <rect x="78" y="144" width="52" height="4" rx="2" fill="#7dd3fc" />
            <rect x="78" y="152" width="28" height="4" rx="2" fill="#86efac" />
          </g>
        </g>

        {/* Patinhas sobre o teclado */}
        <g className="luna-cat__paws">
          <ellipse className="luna-cat__paw luna-cat__paw--left" cx="88" cy="166" rx="14" ry="8" fill="#a78bfa" />
          <ellipse className="luna-cat__paw luna-cat__paw--right" cx="132" cy="166" rx="14" ry="8" fill="#a78bfa" />
        </g>

        {/* Cabeça grande, inclinada quando dorme */}
        <g className="luna-cat__head">
          {/* Orelhas */}
          <path d="M70 66 L64 20 Q63 14 70 18 L100 44 Z" fill={`url(#${fur})`} stroke="#8b6ef0" strokeWidth="4" strokeLinejoin="round" />
          <path d="M150 66 L156 20 Q157 14 150 18 L120 44 Z" fill={`url(#${fur})`} stroke="#8b6ef0" strokeWidth="4" strokeLinejoin="round" />
          <path d="M74 56 L72 32 L92 46 Z" fill="#ffb3d1" />
          <path d="M146 56 L148 32 L128 46 Z" fill="#ffb3d1" />

          <circle cx="110" cy="92" r="52" fill={`url(#${fur})`} />
          <ellipse cx="110" cy="112" rx="26" ry="18" fill="#f7f2ff" />

          {/* Bochechas */}
          <ellipse cx="70" cy="110" rx="11" ry="7" fill={`url(#${blush})`} />
          <ellipse cx="150" cy="110" rx="11" ry="7" fill={`url(#${blush})`} />

          {/* Olhos abertos, com brilho, piscando */}
          <g className="luna-cat__eyes">
            <g className="luna-cat__eye">
              <ellipse cx="88" cy="90" rx="13" ry="15" fill="#fff" />
              <circle cx="90" cy="93" r="9" fill="#2d2350" />
              <circle cx="93" cy="87" r="4" fill="#fff" />
              <circle cx="87" cy="96" r="2" fill="#fff" opacity="0.85" />
            </g>
            <g className="luna-cat__eye">
              <ellipse cx="132" cy="90" rx="13" ry="15" fill="#fff" />
              <circle cx="130" cy="93" r="9" fill="#2d2350" />
              <circle cx="133" cy="87" r="4" fill="#fff" />
              <circle cx="127" cy="96" r="2" fill="#fff" opacity="0.85" />
            </g>
          </g>

          {/* Olhos fechados, em arco feliz */}
          <g className="luna-cat__closed-eyes">
            <path d="M78 94 Q88 82 98 94" fill="none" stroke="#2d2350" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M122 94 Q132 82 142 94" fill="none" stroke="#2d2350" strokeWidth="4.5" strokeLinecap="round" />
          </g>

          {/* Focinho e boca */}
          <path d="M105 106 Q110 102 115 106 Q110 112 105 106 Z" fill="#ff7aa2" stroke="#2d2350" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M102 114 Q106 120 110 115 Q114 120 118 114" fill="none" stroke="#2d2350" strokeWidth="2.8" strokeLinecap="round" />

          {/* Laço no pescoço */}
          <path d="M110 134 C 100 120 86 124 88 134 C 86 144 100 148 110 134 Z" fill="#ff6b8b" stroke="#e8517a" strokeWidth="2" strokeLinejoin="round" />
          <path d="M110 134 C 120 120 134 124 132 134 C 134 144 120 148 110 134 Z" fill="#ff6b8b" stroke="#e8517a" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="110" cy="134" r="4.5" fill="#ff8fa8" />

          {/* Estrela na testa */}
          <path className="luna-cat__star" transform="translate(166 46)" d="M0 -9 L2.6 -3 L9 -2.6 L4 1.6 L5.6 8 L0 4.6 L-5.6 8 L-4 1.6 L-9 -2.6 L-2.6 -3 Z" fill="#ffd66b" stroke="#e0a526" strokeWidth="1.5" strokeLinejoin="round" />
        </g>

        {/* zZ: só enquanto dorme */}
        <text className="luna-cat__z luna-cat__z--first" x="166" y="62">z</text>
        <text className="luna-cat__z luna-cat__z--second" x="178" y="44">z</text>
      </svg>
    </figure>
  );
}
