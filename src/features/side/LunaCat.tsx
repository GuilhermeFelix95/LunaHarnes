import { useId } from "react";

interface LunaCatProps {
  /** Trabalhando: o gatinho anda no lugar. Parado: o gatinho dorme. */
  working: boolean;
}

/// Gatinho lunar em SVG vetorial, de frente, com cabeça grande e pelúcia em gradiente.
/// Trabalhando: anda no lugar, alternando as patas, com o chão passando embaixo.
/// Parado: dorme de olhos fechados, respirando devagar, com "zZ".
/// Sem WebGL e sem biblioteca de animação; as cores são fixas, então o desenho não depende do tema.
export function LunaCat({ working }: LunaCatProps) {
  const id = useId().replace(/:/g, "");
  const label = working ? "Gatinho lunar andando" : "Gatinho lunar dormindo";
  const plush = `${id}-plush`;
  const iris = `${id}-iris`;
  const shadow = `${id}-shadow`;

  return (
    <figure className={`luna-cat ${working ? "luna-cat--working" : "luna-cat--sleeping"}`}>
      <svg viewBox="0 0 240 200" role="img" aria-label={label}>
        <defs>
          <radialGradient id={plush} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#efe6ff" />
            <stop offset="0.45" stopColor="#b59cff" />
            <stop offset="1" stopColor="#7d5ee6" />
          </radialGradient>
          <radialGradient id={iris} cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#5b3f9e" />
            <stop offset="1" stopColor="#2b1d52" />
          </radialGradient>
          <radialGradient id={shadow}>
            <stop offset="0" stopColor="#000" stopOpacity="0.28" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="120" cy="190" rx="78" ry="8" fill={`url(#${shadow})`} />

        {/* Chão: linhas que passam embaixo quando anda */}
        <g className="luna-cat__ground" stroke="#8fd08a" strokeWidth="3" strokeLinecap="round" opacity="0.6">
          <path d="M-40 196 h16 M0 196 h16 M40 196 h16 M80 196 h16 M120 196 h16 M160 196 h16 M200 196 h16 M240 196 h16 M280 196 h16" />
        </g>

        {/* Cauda com ponta branca, atrás do corpo */}
        <g className="luna-cat__tail">
          <path d="M84 166 C 46 166 40 132 52 120" fill="none" stroke={`url(#${plush})`} strokeWidth="12" strokeLinecap="round" />
          <path d="M48 126 C 42 122 40 118 44 114" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" />
        </g>

        {/* Corpo em forma de pera */}
        <g className="luna-cat__body">
          <ellipse cx="120" cy="150" rx="38" ry="32" fill={`url(#${plush})`} />
          <ellipse cx="120" cy="156" rx="22" ry="18" fill="#f1ebff" opacity="0.35" />

          {/* Pernas com patas brancas */}
          <g className="luna-cat__foot luna-cat__foot--left">
            <ellipse cx="104" cy="170" rx="11" ry="12" fill={`url(#${plush})`} />
            <ellipse cx="104" cy="184" rx="13" ry="8" fill="#fff" stroke="#c8b8f5" strokeWidth="1" />
          </g>
          <g className="luna-cat__foot luna-cat__foot--right">
            <ellipse cx="136" cy="170" rx="11" ry="12" fill={`url(#${plush})`} />
            <ellipse cx="136" cy="184" rx="13" ry="8" fill="#fff" stroke="#c8b8f5" strokeWidth="1" />
          </g>

          {/* Braços curtos, com mãos brancas */}
          <g className="luna-cat__arm luna-cat__arm--left" style={{ transformOrigin: "90px 140px" }}>
            <ellipse cx="88" cy="150" rx="10" ry="16" fill={`url(#${plush})`} />
            <ellipse cx="88" cy="164" rx="9" ry="7" fill="#fff" />
          </g>
          <g className="luna-cat__arm luna-cat__arm--right" style={{ transformOrigin: "150px 140px" }}>
            <ellipse cx="152" cy="150" rx="10" ry="16" fill={`url(#${plush})`} />
            <ellipse cx="152" cy="164" rx="9" ry="7" fill="#fff" />
          </g>
        </g>

        {/* Cabeça grande, com orelhas, olhos e focinho */}
        <g className="luna-cat__head">
          <path d="M78 70 C 70 50 68 34 74 28 C 84 26 100 40 108 52 Z" fill={`url(#${plush})`} />
          <path d="M162 70 C 170 50 172 34 166 28 C 156 26 140 40 132 52 Z" fill={`url(#${plush})`} />
          <path d="M82 62 C 78 50 78 40 80 36 C 88 38 96 46 100 52 Z" fill="#ffb3d1" opacity="0.7" />
          <path d="M158 62 C 162 50 162 40 160 36 C 152 38 144 46 140 52 Z" fill="#ffb3d1" opacity="0.7" />

          <circle cx="120" cy="92" r="56" fill={`url(#${plush})`} />

          <ellipse cx="80" cy="116" rx="8" ry="5" fill="#ff9fbf" opacity="0.55" />
          <ellipse cx="160" cy="116" rx="8" ry="5" fill="#ff9fbf" opacity="0.55" />

          {/* Olhos abertos, grandes, com brilho */}
          <g className="luna-cat__eyes-open">
            <ellipse cx="96" cy="98" rx="17" ry="20" fill="#fff" stroke="#3b2a6b" strokeWidth="1.5" />
            <ellipse cx="98" cy="102" rx="12" ry="14" fill={`url(#${iris})`} />
            <circle cx="102" cy="94" r="5" fill="#fff" />
            <circle cx="94" cy="106" r="2.2" fill="#fff" />
            <ellipse cx="144" cy="98" rx="17" ry="20" fill="#fff" stroke="#3b2a6b" strokeWidth="1.5" />
            <ellipse cx="142" cy="102" rx="12" ry="14" fill={`url(#${iris})`} />
            <circle cx="138" cy="94" r="5" fill="#fff" />
            <circle cx="146" cy="106" r="2.2" fill="#fff" />
          </g>

          {/* Olhos fechados, dormindo */}
          <g className="luna-cat__eyes-closed" fill="none" stroke="#3b2766" strokeWidth="3.5" strokeLinecap="round">
            <path d="M82 100 Q96 112 110 100" />
            <path d="M130 100 Q144 112 158 100" />
          </g>

          <path d="M84 72 Q94 66 104 72 M136 72 Q146 66 156 72" fill="none" stroke="#6b4fd0" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M115 112 Q120 108 125 112 Q122 117 120 118 Q118 117 115 112 Z" fill="#ff7fa6" stroke="#c44d7a" strokeWidth="1" />
          <path d="M112 122 Q116 128 120 123 Q124 128 128 122" fill="none" stroke="#5a3fc0" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M74 114 L52 110 M74 118 L52 120 M166 114 L188 110 M166 118 L188 120" stroke="#7a62c7" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
        </g>

        {/* zZ, só enquanto dorme */}
        <text className="luna-cat__z luna-cat__z--first" x="180" y="60">z</text>
        <text className="luna-cat__z luna-cat__z--second" x="192" y="44">z</text>
      </svg>
    </figure>
  );
}
