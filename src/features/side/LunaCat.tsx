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
  const furDark = `${id}-fur-dark`;
  const mouse = `${id}-mouse`;
  const shadow = `${id}-shadow`;
  const bowl = `${id}-bowl`;

  return (
    <figure className={`luna-cat ${working ? "luna-cat--working" : "luna-cat--sleeping"}`}>
      <svg viewBox="0 0 240 170" role="img" aria-label={label}>
        <defs>
          <linearGradient id={fur} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d2c4ff" />
            <stop offset="0.55" stopColor="#9f83f5" />
            <stop offset="1" stopColor="#7257d6" />
          </linearGradient>
          <linearGradient id={furDark} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8b6ef0" />
            <stop offset="1" stopColor="#5a3fc0" />
          </linearGradient>
          <linearGradient id={mouse} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f1edf7" />
            <stop offset="1" stopColor="#b8afc8" />
          </linearGradient>
          <linearGradient id={bowl} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#6d72a8" />
            <stop offset="0.5" stopColor="#8d93c9" />
            <stop offset="1" stopColor="#5d6298" />
          </linearGradient>
          <radialGradient id={shadow}>
            <stop offset="0" stopColor="#000" stopOpacity="0.25" />
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
            <path className="luna-cat__mouse-tail" d="M182 149 C 168 151 164 141 172 136 C 176 133 174 129 168 127" fill="none" stroke="#aaa2bb" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="191" cy="157" rx="3.5" ry="2" fill="#e5dfee" stroke="#5a5470" strokeWidth="0.8" />
            <ellipse cx="203" cy="157" rx="3.5" ry="2" fill="#e5dfee" stroke="#5a5470" strokeWidth="0.8" />
            <path d="M182 150 C 182 139 198 134 208 138 C 214 141 214 150 210 155 C 202 159 186 158 182 150 Z" fill={`url(#${mouse})`} stroke="#5a5470" strokeWidth="1.6" />
            <ellipse cx="197" cy="151" rx="9" ry="3.5" fill="#fbf9fd" opacity="0.8" />
            <path d="M206 142 C 206 134 216 131 222 136 L 232 144 C 233 147 231 149 227 149 C 221 150 212 151 207 150 Z" fill={`url(#${mouse})`} stroke="#5a5470" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="214" cy="132" r="4.6" fill="#e9e2ef" stroke="#5a5470" strokeWidth="1.4" />
            <circle cx="214" cy="132" r="2.4" fill="#ffb3d1" />
            <circle cx="221" cy="141" r="1.5" fill="#2d2350" />
            <circle cx="232.5" cy="146.5" r="1.7" fill="#ff7aa2" />
            <path d="M230 145 L242 142 M230 148 L242 150" stroke="#5a5470" strokeWidth="0.7" strokeLinecap="round" />
          </g>

          <g className="luna-cat__chaser">
            <path className="luna-cat__tail-run" d="M90 120 C 72 118 66 100 74 90" fill="none" stroke={`url(#${furDark})`} strokeWidth="8" strokeLinecap="round" />
            <path d="M74 90 C 70 86 72 80 78 80" fill="none" stroke="#5a3fc0" strokeWidth="8" strokeLinecap="round" />

            {/* Pernas do fundo (fase oposta) e da frente */}
            <g className="luna-cat__leg luna-cat__leg--far" style={{ transformOrigin: "106px 128px" }}>
              <path d="M106 128 L105 150" fill="none" stroke="#5a3fc0" strokeWidth="8.5" strokeLinecap="round" />
              <ellipse cx="105" cy="153" rx="5.5" ry="3.2" fill="#d9ccff" stroke="#5a3fc0" strokeWidth="1" />
            </g>
            <g className="luna-cat__leg luna-cat__leg--far" style={{ transformOrigin: "128px 128px" }}>
              <path d="M128 128 L127 150" fill="none" stroke="#5a3fc0" strokeWidth="8.5" strokeLinecap="round" />
              <ellipse cx="127" cy="153" rx="5.5" ry="3.2" fill="#d9ccff" stroke="#5a3fc0" strokeWidth="1" />
            </g>
            <g className="luna-cat__leg luna-cat__leg--near" style={{ transformOrigin: "96px 126px" }}>
              <path d="M96 126 L95 150" fill="none" stroke="#8b6ef0" strokeWidth="8.5" strokeLinecap="round" />
              <ellipse cx="95" cy="153" rx="5.5" ry="3.2" fill="#e6dcff" stroke="#7257d6" strokeWidth="1" />
            </g>
            <g className="luna-cat__leg luna-cat__leg--near" style={{ transformOrigin: "138px 126px" }}>
              <path d="M138 126 L137 150" fill="none" stroke="#8b6ef0" strokeWidth="8.5" strokeLinecap="round" />
              <ellipse cx="137" cy="153" rx="5.5" ry="3.2" fill="#e6dcff" stroke="#7257d6" strokeWidth="1" />
            </g>

            {/* Tronco comprido, com listras e barriga mais clara */}
            <path d="M88 116 C 96 104 128 102 140 110 C 150 116 152 130 144 136 C 130 144 98 144 90 136 C 85 131 84 122 88 116 Z" fill={`url(#${fur})`} stroke="#6b4fd0" strokeWidth="1.2" />
            <path d="M100 110 q3 7 1 13 M110 106 q3 7 1 13 M120 105 q3 7 1 12" fill="none" stroke="#6b4fd0" strokeWidth="2.6" strokeLinecap="round" opacity="0.45" />
            <ellipse cx="120" cy="131" rx="18" ry="5" fill="#efe8ff" opacity="0.45" />

            {/* Orelha de trás (mais escura) e cabeça com focinho */}
            <path d="M140 90 L138 68 L154 82 Z" fill={`url(#${furDark})`} stroke="#5a3fc0" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M142 86 L141 74 L150 83 Z" fill="#ffb3d1" opacity="0.85" />
            <path d="M138 92 C 138 82 152 78 162 82 C 170 85 174 94 173 102 C 172 110 166 114 158 115 C 150 116 140 112 138 104 Z" fill={`url(#${fur})`} stroke="#6b4fd0" strokeWidth="1.2" />
            <path d="M152 84 L158 66 L166 88 Z" fill={`url(#${fur})`} stroke="#6b4fd0" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M154 84 L158 73 L163 86 Z" fill="#ffb3d1" opacity="0.85" />
            <ellipse cx="152" cy="90" rx="9" ry="4" fill="#fff" opacity="0.2" />
            <ellipse cx="160" cy="106" rx="5" ry="3" fill="#ff9fbf" opacity="0.5" />

            {/* Olho de perfil, nariz e boca */}
            <path d="M160 94 Q166 89 171 95 Q166 100 160 94 Z" fill="#2d2350" />
            <circle cx="166.5" cy="93.5" r="1.3" fill="#fff" />
            <path d="M172 101 L176 103 L172 105 Z" fill="#ff7aa2" />
            <path d="M168 108 q-3 3 -6 1" fill="none" stroke="#2d2350" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M170 104 L186 101 M170 106 L186 107 M168 107 L182 112" stroke="#4b3f7a" strokeWidth="0.8" strokeLinecap="round" />
          </g>
        </g>

        {/* Cena dormindo: gatinho enrolado, tigela de ração e ratinho comendo */}
        <g className="luna-cat__resting">
          <ellipse cx="194" cy="136" rx="26" ry="5" fill="#2c2b48" />
          <path d="M168 136 Q170 158 194 160 Q218 158 220 136 Z" fill={`url(#${bowl})`} stroke="#3b3a5c" strokeWidth="2" strokeLinejoin="round" />
          <path d="M176 146 Q180 156 192 158" fill="none" stroke="#c4c9ee" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <ellipse cx="194" cy="136" rx="22" ry="4" fill="#2c2b48" />
          <ellipse cx="182" cy="133" rx="3.6" ry="2.7" fill="#d9a066" stroke="#8a5a2b" strokeWidth="1" />
          <ellipse cx="193" cy="131" rx="3.6" ry="2.7" fill="#d9a066" stroke="#8a5a2b" strokeWidth="1" />
          <ellipse cx="204" cy="133" rx="3.6" ry="2.7" fill="#d9a066" stroke="#8a5a2b" strokeWidth="1" />
          <ellipse cx="188" cy="136" rx="3.6" ry="2.7" fill="#d9a066" stroke="#8a5a2b" strokeWidth="1" />
          <ellipse cx="200" cy="137" rx="3.6" ry="2.7" fill="#d9a066" stroke="#8a5a2b" strokeWidth="1" />

          <path d="M46 150 C 26 152 22 138 34 136" fill="none" stroke="#7257d6" strokeWidth="8" strokeLinecap="round" />
          <g className="luna-cat__breath">
            <path d="M44 146 C 38 128 64 116 100 116 C 130 116 142 130 138 146 C 134 156 48 158 44 146 Z" fill={`url(#${fur})`} stroke="#6b4fd0" strokeWidth="1.2" />
            <ellipse cx="110" cy="138" rx="16" ry="12" fill="#5a3fc0" opacity="0.18" />
            <path d="M70 122 q4 6 2 12 M84 118 q4 6 2 12" fill="none" stroke="#6b4fd0" strokeWidth="2.4" strokeLinecap="round" opacity="0.45" />
          </g>
          <ellipse cx="66" cy="152" rx="9" ry="4" fill="#d9ccff" stroke="#7257d6" strokeWidth="1.2" />
          <path d="M62 150 v4 M66 150 v4" stroke="#7257d6" strokeWidth="0.8" />

          <g className="luna-cat__rest-head">
            <polygon points="38,122 34,100 50,113" fill={`url(#${furDark})`} stroke="#5a3fc0" strokeWidth="1.2" strokeLinejoin="round" />
            <polygon points="56,114 68,100 70,122" fill={`url(#${furDark})`} stroke="#5a3fc0" strokeWidth="1.2" strokeLinejoin="round" />
            <polygon points="39,119 37,106 47,114" fill="#ffb3d1" opacity="0.85" />
            <polygon points="58,115 66,106 68,119" fill="#ffb3d1" opacity="0.85" />
            <path d="M36 128 C 34 114 46 110 52 113 C 62 110 72 116 70 130 C 69 142 60 148 52 148 C 42 148 37 140 36 128 Z" fill={`url(#${fur})`} stroke="#6b4fd0" strokeWidth="1.2" />
            <ellipse cx="44" cy="140" rx="3.5" ry="2.5" fill="#ff9fbf" opacity="0.5" />
            <ellipse cx="62" cy="140" rx="3.5" ry="2.5" fill="#ff9fbf" opacity="0.5" />
            <path d="M40 131 q5 4 9 0 M54 130 q5 4 9 0" fill="none" stroke="#2d2350" strokeWidth="2.2" strokeLinecap="round" />
            <ellipse cx="52" cy="139" rx="2.2" ry="1.5" fill="#ff7aa2" />
          </g>

          <g className="luna-cat__mouse-eat" style={{ transformOrigin: "172px 142px" }}>
            <path d="M147 153 C 137 156 137 146 145 146" fill="none" stroke="#aaa2bb" strokeWidth="2" strokeLinecap="round" />
            <path d="M150 152 C 148 140 158 134 166 138 C 170 142 170 154 164 158 C 158 160 152 158 150 152 Z" fill={`url(#${mouse})`} stroke="#5a5470" strokeWidth="1.6" />
            <path d="M166 140 C 166 133 176 131 180 136 L 187 143 C 187 147 185 149 180 149 C 175 150 169 149 166 146 Z" fill={`url(#${mouse})`} stroke="#5a5470" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="170" cy="132" r="4.2" fill="#e9e2ef" stroke="#5a5470" strokeWidth="1.4" />
            <circle cx="170" cy="132" r="2.2" fill="#ffb3d1" />
            <circle cx="177" cy="140" r="1.3" fill="#2d2350" />
            <circle cx="186.5" cy="145" r="1.5" fill="#ff7aa2" />
          </g>

          <text className="luna-cat__z luna-cat__z--first" x="78" y="100">z</text>
          <text className="luna-cat__z luna-cat__z--second" x="92" y="82">z</text>
        </g>
      </svg>
    </figure>
  );
}
