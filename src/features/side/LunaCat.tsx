import { useId } from "react";

interface LunaCatProps {
  /** Trabalhando: o gatinho corre atrás do ratinho. Parado: dorme enquanto o ratinho come a ração. */
  working: boolean;
}

/// Cena do gatinho lunar em SVG vetorial, animada com CSS.
/// Trabalhando: gatinho correndo atrás de um ratinho. Parado: gatinho dormindo e ratinho comendo na tigela.
/// Sem WebGL e sem biblioteca de animação; as cores são fixas, então a cena não depende do tema.
export function LunaCat({ working }: LunaCatProps) {
  const id = useId().replace(/:/g, "");
  const label = working ? "Gatinho lunar correndo atrás de um ratinho" : "Gatinho lunar dormindo enquanto o ratinho come";
  const fur = `${id}-fur`;
  const shadow = `${id}-shadow`;

  return (
    <figure className={`luna-cat ${working ? "luna-cat--working" : "luna-cat--sleeping"}`}>
      <svg viewBox="0 0 240 170" role="img" aria-label={label}>
        <defs>
          <linearGradient id={fur} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c4b2ff" />
            <stop offset="1" stopColor="#8b6ef0" />
          </linearGradient>
          <radialGradient id={shadow}>
            <stop offset="0" stopColor="#000" stopOpacity="0.22" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sombra no chão */}
        <ellipse cx="120" cy="160" rx="110" ry="7" fill={`url(#${shadow})`} />

        {/* Cena correndo: gatinho atrás, ratinho na frente */}
        <g className="luna-cat__running">
          <ellipse className="luna-cat__dust luna-cat__dust--a" cx="74" cy="156" rx="6" ry="3" fill="#cfc6ea" />
          <ellipse className="luna-cat__dust luna-cat__dust--b" cx="66" cy="150" rx="4" ry="2.5" fill="#cfc6ea" />

          <g className="luna-cat__mouse">
            <path className="luna-cat__mouse-tail" d="M186 146 C 174 146 170 136 178 130" fill="none" stroke="#8e8a9c" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M196 156 L192 162 M206 156 L210 162" stroke="#5a5470" strokeWidth="2.5" strokeLinecap="round" />
            <ellipse cx="200" cy="146" rx="14" ry="9" fill="#d8d4e2" stroke="#5a5470" strokeWidth="2.5" />
            <circle cx="213" cy="140" r="8" fill="#d8d4e2" stroke="#5a5470" strokeWidth="2.5" />
            <circle cx="208" cy="132" r="4.5" fill="#ffb3d1" stroke="#5a5470" strokeWidth="2" />
            <circle cx="216" cy="138" r="1.6" fill="#2d2350" />
            <circle cx="221" cy="141" r="1.8" fill="#ff7aa2" />
          </g>

          <g className="luna-cat__chaser">
            <path className="luna-cat__tail-run" d="M92 118 C 74 110 70 96 80 90" fill="none" stroke="#8b6ef0" strokeWidth="9" strokeLinecap="round" />

            {/* Pernas do fundo (fase oposta) e da frente */}
            <path className="luna-cat__leg luna-cat__leg--far" style={{ transformOrigin: "104px 134px" }} d="M104 134 L104 156" fill="none" stroke="#7257d6" strokeWidth="10" strokeLinecap="round" />
            <path className="luna-cat__leg luna-cat__leg--far" style={{ transformOrigin: "132px 134px" }} d="M132 134 L132 156" fill="none" stroke="#7257d6" strokeWidth="10" strokeLinecap="round" />
            <path className="luna-cat__leg luna-cat__leg--near" style={{ transformOrigin: "98px 134px" }} d="M98 134 L98 156" fill="none" stroke="#8b6ef0" strokeWidth="10" strokeLinecap="round" />
            <path className="luna-cat__leg luna-cat__leg--near" style={{ transformOrigin: "138px 134px" }} d="M138 134 L138 156" fill="none" stroke="#8b6ef0" strokeWidth="10" strokeLinecap="round" />

            <ellipse cx="118" cy="124" rx="30" ry="18" fill={`url(#${fur})`} />

            <polygon points="138,96 136,76 152,88" fill={`url(#${fur})`} stroke="#8b6ef0" strokeWidth="3" strokeLinejoin="round" />
            <polygon points="160,88 168,76 168,98" fill={`url(#${fur})`} stroke="#8b6ef0" strokeWidth="3" strokeLinejoin="round" />
            <circle cx="152" cy="104" r="18" fill={`url(#${fur})`} />
            <ellipse cx="158" cy="102" rx="3.4" ry="4" fill="#2d2350" />
            <circle cx="159.2" cy="100.6" r="1.1" fill="#fff" />
            <circle cx="164" cy="107" r="1.8" fill="#ff7aa2" />
            <path d="M160 111 q3 2 5 -1" fill="none" stroke="#2d2350" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        </g>

        {/* Cena dormindo: gatinho enrolado, tigela de ração e ratinho comendo */}
        <g className="luna-cat__resting">
          <ellipse cx="194" cy="136" rx="26" ry="5" fill="#3b3a5c" />
          <path d="M168 136 Q170 158 194 160 Q218 158 220 136 Z" fill="#7d82b8" stroke="#3b3a5c" strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="182" cy="133" r="3.2" fill="#d9a066" stroke="#8a5a2b" strokeWidth="1.2" />
          <circle cx="193" cy="131" r="3.2" fill="#d9a066" stroke="#8a5a2b" strokeWidth="1.2" />
          <circle cx="204" cy="133" r="3.2" fill="#d9a066" stroke="#8a5a2b" strokeWidth="1.2" />
          <circle cx="188" cy="136" r="3.2" fill="#d9a066" stroke="#8a5a2b" strokeWidth="1.2" />
          <circle cx="200" cy="137" r="3.2" fill="#d9a066" stroke="#8a5a2b" strokeWidth="1.2" />

          <path d="M40 150 C 22 152 22 136 34 136" fill="none" stroke="#8b6ef0" strokeWidth="9" strokeLinecap="round" />
          <g className="luna-cat__breath">
            <ellipse cx="88" cy="140" rx="50" ry="20" fill={`url(#${fur})`} />
          </g>
          <ellipse cx="62" cy="150" rx="10" ry="5" fill="#c4b2ff" stroke="#8b6ef0" strokeWidth="2" />
          <g className="luna-cat__rest-head">
            <polygon points="36,122 34,100 50,114" fill={`url(#${fur})`} stroke="#8b6ef0" strokeWidth="3" strokeLinejoin="round" />
            <polygon points="58,114 70,100 70,122" fill={`url(#${fur})`} stroke="#8b6ef0" strokeWidth="3" strokeLinejoin="round" />
            <circle cx="52" cy="132" r="19" fill={`url(#${fur})`} />
            <path d="M40 131 Q45 136 50 131" fill="none" stroke="#2d2350" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M54 131 Q59 136 64 131" fill="none" stroke="#2d2350" strokeWidth="2.5" strokeLinecap="round" />
            <ellipse cx="52" cy="139" rx="2.2" ry="1.6" fill="#ff7aa2" />
          </g>

          <g className="luna-cat__mouse-eat" style={{ transformOrigin: "172px 142px" }}>
            <path d="M147 152 C 138 156 140 146 146 146" fill="none" stroke="#8e8a9c" strokeWidth="2.5" strokeLinecap="round" />
            <ellipse cx="160" cy="150" rx="12" ry="9" fill="#d8d4e2" stroke="#5a5470" strokeWidth="2.5" />
            <circle cx="172" cy="142" r="8" fill="#d8d4e2" stroke="#5a5470" strokeWidth="2.5" />
            <circle cx="168" cy="134" r="4" fill="#ffb3d1" stroke="#5a5470" strokeWidth="2" />
            <circle cx="176" cy="140" r="1.4" fill="#2d2350" />
            <circle cx="180" cy="143" r="1.6" fill="#ff7aa2" />
          </g>

          <text className="luna-cat__z luna-cat__z--first" x="78" y="100">z</text>
          <text className="luna-cat__z luna-cat__z--second" x="92" y="82">z</text>
        </g>
      </svg>
    </figure>
  );
}
