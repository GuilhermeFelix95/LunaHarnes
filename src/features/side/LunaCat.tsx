import { useId } from "react";

interface LunaCatProps {
  /** Trabalhando: o gatinho anda. Parado: o gatinho dorme. */
  working: boolean;
}

/// Gatinho lunar em SVG vetorial, animado com CSS.
/// Trabalhando: anda com ciclo de caminhada em diagonal (patas opostas juntas). Parado: dorme enrolado e respira.
/// Sem WebGL e sem biblioteca de animação; as cores são fixas, então o desenho não depende do tema.
export function LunaCat({ working }: LunaCatProps) {
  const id = useId().replace(/:/g, "");
  const label = working ? "Gatinho lunar andando" : "Gatinho lunar dormindo";
  const fur = `${id}-fur`;
  const shadow = `${id}-shadow`;

  return (
    <figure className={`luna-cat ${working ? "luna-cat--working" : "luna-cat--sleeping"}`}>
      <svg viewBox="0 0 240 170" role="img" aria-label={label}>
        <defs>
          <linearGradient id={fur} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d2c4ff" />
            <stop offset="0.6" stopColor="#9f83f5" />
            <stop offset="1" stopColor="#7257d6" />
          </linearGradient>
          <radialGradient id={shadow}>
            <stop offset="0" stopColor="#000" stopOpacity="0.25" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="120" cy="160" rx="100" ry="6" fill={`url(#${shadow})`} />

        {/* Andando: o chão passa por trás do gatinho, dando a sensação de deslocamento */}
        <g className="luna-cat__walking">
          <g className="luna-cat__ground" stroke="#4b4870" strokeWidth="2" strokeLinecap="round">
            <path d="M-40 158 h14 M0 158 h14 M40 158 h14 M80 158 h14 M120 158 h14 M160 158 h14 M200 158 h14 M240 158 h14 M280 158 h14" />
          </g>

          <g className="luna-cat__body-walk">
            {/* Cauda levantada, balançando */}
            <path className="luna-cat__tail" d="M86 100 C 68 96 64 76 74 66" fill="none" stroke="#7257d6" strokeWidth="8" strokeLinecap="round" />

            {/* Patas de trás e da frente: pares diagonais, uma metade do ciclo de cada vez */}
            <path className="luna-cat__leg luna-cat__leg--a" style={{ transformOrigin: "98px 110px" }} d="M98 110 L96 146" fill="none" stroke="#8b6ef0" strokeWidth="9" strokeLinecap="round" />
            <path className="luna-cat__leg luna-cat__leg--b" style={{ transformOrigin: "138px 110px" }} d="M138 110 L140 146" fill="none" stroke="#8b6ef0" strokeWidth="9" strokeLinecap="round" />
            <path className="luna-cat__leg luna-cat__leg--b" style={{ transformOrigin: "106px 110px" }} d="M106 110 L104 146" fill="none" stroke="#5a3fc0" strokeWidth="9" strokeLinecap="round" />
            <path className="luna-cat__leg luna-cat__leg--a" style={{ transformOrigin: "130px 110px" }} d="M130 110 L132 146" fill="none" stroke="#5a3fc0" strokeWidth="9" strokeLinecap="round" />

            <ellipse cx="118" cy="98" rx="36" ry="18" fill={`url(#${fur})`} stroke="#6b4fd0" strokeWidth="1.2" />

            {/* Cabeça com orelhas */}
            <polygon points="146,84 146,62 160,76" fill="#7a5ee6" stroke="#5a3fc0" strokeWidth="1.2" strokeLinejoin="round" />
            <polygon points="158,80 166,62 170,82" fill={`url(#${fur})`} stroke="#6b4fd0" strokeWidth="1.2" strokeLinejoin="round" />
            <ellipse cx="156" cy="84" rx="16" ry="14" fill={`url(#${fur})`} stroke="#6b4fd0" strokeWidth="1.2" />
            <path d="M166 84 Q172 86 168 90 Q164 92 160 88" fill="#ff9fbf" opacity="0.6" />
            <circle cx="164" cy="82" r="2" fill="#2d2350" />
          </g>
        </g>

        {/* Dormindo: gatinho enrolado, respirando devagar, com "zZ" */}
        <g className="luna-cat__sleeping">
          <path d="M170 136 C 186 142 186 124 176 122" fill="none" stroke="#7257d6" strokeWidth="8" strokeLinecap="round" />
          <g className="luna-cat__breath">
            <path d="M52 140 C 48 118 80 108 116 110 C 148 112 162 126 158 140 C 154 150 60 152 52 140 Z" fill={`url(#${fur})`} stroke="#6b4fd0" strokeWidth="1.2" />
          </g>
          <ellipse cx="72" cy="148" rx="11" ry="4.5" fill="#d9ccff" stroke="#7257d6" strokeWidth="1.2" />
          <polygon points="42,118 38,96 56,108" fill="#7a5ee6" stroke="#5a3fc0" strokeWidth="1.2" strokeLinejoin="round" />
          <polygon points="56,108 66,96 68,118" fill={`url(#${fur})`} stroke="#6b4fd0" strokeWidth="1.2" strokeLinejoin="round" />
          <ellipse cx="54" cy="128" rx="20" ry="18" fill={`url(#${fur})`} stroke="#6b4fd0" strokeWidth="1.2" />
          <path d="M44 128 q4 4 8 0 M58 128 q4 4 8 0" fill="none" stroke="#2d2350" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="51" cy="136" rx="2" ry="1.4" fill="#ff7aa2" />
          <text className="luna-cat__z luna-cat__z--first" x="74" y="100">z</text>
          <text className="luna-cat__z luna-cat__z--second" x="88" y="82">z</text>
        </g>
      </svg>
    </figure>
  );
}
