// Cache de Tokens v1.0: painel na barra lateral com a taxa de acerto do cache de prompt da conversa.
// Mostra quanto da entrada veio do cache, de onde vieram os tokens, o histórico dos últimos turnos
// e o motivo de um acerto baixo. Só lê o resumo que o núcleo mede (api.cache.stats); não muda o envio.
/// <reference path="../luna-plugin.d.ts" />

const COLAPSADO_KEY = "luna.plugin.cache-tokens.colapsado";
const CIRCUNFERENCIA = 2 * Math.PI * 34;

const CSS = `
.cache-tokens{margin:8px 10px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--card-radius,12px);background:var(--surface);color:var(--fg);font-size:12px}
.cache-tokens__head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.cache-tokens__title{font-weight:600;font-size:13px}
.cache-tokens__badge{padding:2px 8px;border-radius:999px;background:var(--hover);color:var(--fg-muted);font-size:11px;white-space:nowrap}
.cache-tokens__badge--ok{color:var(--success)}
.cache-tokens__badge--alerta{color:var(--warning)}
.cache-tokens__toggle{border:none;background:none;color:var(--fg-muted);cursor:pointer;font-size:12px;padding:2px 4px}
.cache-tokens__body{display:grid;gap:10px}
.cache-tokens__ring{display:flex;align-items:center;gap:12px}
.cache-tokens__ring svg{width:76px;height:76px;flex:none}
.cache-tokens__track{stroke:var(--border-strong);stroke-width:7}
.cache-tokens__arc{stroke:var(--accent);stroke-width:7;stroke-linecap:round;transform:rotate(-90deg);transform-origin:50% 50%;transition:stroke-dashoffset .4s ease}
.cache-tokens__pct{font-size:18px;font-weight:600;fill:var(--fg)}
.cache-tokens__legenda{color:var(--fg-muted);line-height:1.4;margin:0}
.cache-tokens__bars{display:grid;gap:5px}
.cache-tokens__bar{display:grid;grid-template-columns:72px 1fr 56px;align-items:center;gap:6px}
.cache-tokens__bar span:last-child{text-align:right;color:var(--fg-muted)}
.cache-tokens__track-bar{height:6px;border-radius:999px;background:var(--hover);overflow:hidden}
.cache-tokens__fill{height:100%;border-radius:999px;background:var(--accent)}
.cache-tokens__fill--novos{background:var(--fg-subtle)}
.cache-tokens__fill--gravados{background:var(--warning)}
.cache-tokens__hist{display:flex;align-items:flex-end;gap:3px;height:34px}
.cache-tokens__hist i{flex:1;min-height:2px;border-radius:3px 3px 0 0;background:var(--accent);opacity:.85}
.cache-tokens__hist i.vazio{background:var(--border-strong);opacity:.6}
.cache-tokens__ultimo{color:var(--fg-muted);line-height:1.4;margin:0}
.cache-tokens__dica{margin:0;padding:6px 8px;border-radius:8px;background:var(--accent-soft);color:var(--fg);line-height:1.4}
`;

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return String(n);
}

function pct(rate) {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

function tempo(ms) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function esc(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const MOTIVOS = {
  aquecendo: "primeiro turno: o cache ainda estava sendo montado",
  "sessao-nova": "sessão nova: o cache começa do zero",
  "modelo-trocado": "modelo trocado: cada modelo tem o próprio cache",
  "prompt-mudou": "o prompt de sistema mudou e invalidou o cache",
  pausa: "pausa maior que o tempo de vida do cache",
  desconhecido: "acerto baixo sem causa clara",
};

function estadoDoCache(warm) {
  if (warm.state === "quente") return { texto: `quente por ${tempo(warm.remainingMs)}`, cls: "ok" };
  if (warm.state === "frio") return { texto: "frio", cls: "alerta" };
  if (warm.state === "sem-ttl") return { texto: "sem TTL informado", cls: "" };
  return { texto: "sem dados", cls: "" };
}

function anel(rate) {
  const offset = rate === null ? CIRCUNFERENCIA : CIRCUNFERENCIA * (1 - rate);
  return `<svg viewBox="0 0 76 76" role="img" aria-label="Taxa de acerto ${pct(rate)}">
    <circle class="cache-tokens__track" cx="38" cy="38" r="34" fill="none"/>
    <circle class="cache-tokens__arc" cx="38" cy="38" r="34" fill="none" stroke-dasharray="${CIRCUNFERENCIA.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"/>
    <text class="cache-tokens__pct" x="38" y="43" text-anchor="middle">${pct(rate)}</text>
  </svg>`;
}

function barra(rotulo, valor, maximo, cls) {
  const largura = maximo > 0 ? Math.max(2, Math.round((valor / maximo) * 100)) : 0;
  return `<div class="cache-tokens__bar"><span>${rotulo}</span><span class="cache-tokens__track-bar"><span class="cache-tokens__fill ${cls}" style="display:block;width:${largura}%"></span></span><span>${fmt(valor)}</span></div>`;
}

function historico(history) {
  const barras = history.map((rate) => {
    if (rate === null) return `<i class="vazio" style="height:12%"></i>`;
    return `<i title="${pct(rate)}" style="height:${Math.max(8, Math.round(rate * 100))}%"></i>`;
  });
  return `<div class="cache-tokens__hist" aria-label="Histórico dos últimos turnos">${barras.join("")}</div>`;
}

function montar(stats, colapsado) {
  const cabecalho = (badge) =>
    `<div class="cache-tokens__head"><span class="cache-tokens__title">Cache</span>${badge}<button type="button" class="cache-tokens__toggle" data-acao="colapsar" aria-expanded="${!colapsado}">${colapsado ? "Mostrar" : "Recolher"}</button></div>`;

  if (!stats) {
    return `<section class="cache-tokens" aria-label="Cache de tokens">${cabecalho("")}${colapsado ? "" : `<p class="cache-tokens__legenda">Aguardando o primeiro turno com medição.</p>`}</section>`;
  }

  const estado = estadoDoCache(stats.warm);
  const badge = `<span class="cache-tokens__badge ${estado.cls ? `cache-tokens__badge--${estado.cls}` : ""}">${esc(estado.texto)}</span>`;
  if (colapsado) {
    return `<section class="cache-tokens" aria-label="Cache de tokens">${cabecalho(badge)}</section>`;
  }

  const maximo = Math.max(stats.readTotal, stats.freshTotal, stats.writeTotal);
  const ultimo = stats.last
    ? `Último turno: ${pct(stats.last.rate)} em ${esc(stats.last.model || "modelo padrão")}${stats.last.diagnosis ? `. ${esc(MOTIVOS[stats.last.diagnosis] ?? "")}` : ""}.`
    : "Sem turno medido ainda.";
  const dica = stats.tip ? `<p class="cache-tokens__dica">${esc(stats.tip)}</p>` : "";

  return `<section class="cache-tokens" aria-label="Cache de tokens">
    ${cabecalho(badge)}
    <div class="cache-tokens__body">
      <div class="cache-tokens__ring">${anel(stats.session)}<p class="cache-tokens__legenda">da entrada da conversa veio do cache.</p></div>
      <div class="cache-tokens__bars">
        ${barra("do cache", stats.readTotal, maximo, "")}
        ${barra("gravados", stats.writeTotal, maximo, "cache-tokens__fill--gravados")}
        ${barra("novos", stats.freshTotal, maximo, "cache-tokens__fill--novos")}
      </div>
      ${historico(stats.history)}
      <p class="cache-tokens__ultimo">${ultimo}</p>
      ${dica}
    </div>
  </section>`;
}

function resumoTexto(stats) {
  if (!stats) return "Cache de tokens: ainda sem turno medido nesta conversa.";
  const motivo = stats.last?.diagnosis ? ` Motivo: ${MOTIVOS[stats.last.diagnosis] ?? stats.last.diagnosis}.` : "";
  return `Cache de tokens: ${pct(stats.session)} da entrada veio do cache (${fmt(stats.readTotal)} lidos, ${fmt(stats.writeTotal)} gravados, ${fmt(stats.freshTotal)} novos). Último turno: ${pct(stats.last?.rate ?? null)}.${motivo}`;
}

function lerColapsado() {
  try {
    return localStorage.getItem(COLAPSADO_KEY) === "1";
  } catch {
    return false;
  }
}

function salvarColapsado(valor) {
  try {
    localStorage.setItem(COLAPSADO_KEY, valor ? "1" : "0");
  } catch {
    // Sem armazenamento, a escolha vale só nesta sessão.
  }
}

export function activate(api) {
  api.ui.addStyle(CSS);
  let colapsado = lerColapsado();
  let atualizar = () => {};

  api.ui.mount("sidebar", (el) => {
    const desenhar = () => {
      el.innerHTML = montar(api.cache.stats(), colapsado);
      const botao = el.querySelector("[data-acao=colapsar]");
      if (botao) {
        botao.onclick = () => {
          colapsado = !colapsado;
          salvarColapsado(colapsado);
          desenhar();
        };
      }
    };
    atualizar = desenhar;
    desenhar();
    return () => {
      atualizar = () => {};
      el.innerHTML = "";
    };
  });

  api.onAfterResponse(() => atualizar());

  api.registerCommand("cache", () => {
    api.cache.notify(resumoTexto(api.cache.stats()));
  });
}
