// Cache de Tokens: liga o cache de respostas da sessão, mostra a taxa de acerto na barra lateral
// e oferece /cache e /cache-limpar. Os comandos mostram o resultado como aviso local, sem enviar nada ao agente.
/// <reference path="../luna-plugin.d.ts" />

function taxaDeAcerto({ hits, lookups }) {
  if (lookups === 0) return "aguardando consultas";
  return `${((hits / lookups) * 100).toFixed(1)}%`;
}

export function activate(api) {
  api.cache.setEnabled(true);

  let atualizarBloco = () => {};

  api.ui.mount("sidebar", (el) => {
    el.className = "cache-tokens-resumo";
    el.style.cssText = "padding:6px 10px;font-size:12px;opacity:0.85";
    atualizarBloco = () => {
      const { hits, lookups, stored } = api.cache.stats();
      el.textContent = `Cache: ${taxaDeAcerto({ hits, lookups })} de acerto (${hits} de ${lookups}), ${stored} guardada(s)`;
    };
    atualizarBloco();
    return () => {
      atualizarBloco = () => {};
    };
  });

  api.onAfterResponse(() => atualizarBloco());

  api.registerCommand("cache", (args) => {
    const acao = args.trim();
    if (acao === "ligar" || acao === "desligar") {
      api.cache.setEnabled(acao === "ligar");
      api.cache.notify(`Cache de respostas ${acao === "ligar" ? "ligado" : "desligado"}.`);
      atualizarBloco();
      return;
    }
    const { hits, lookups, stored } = api.cache.stats();
    api.cache.notify(
      `Cache de respostas: taxa de acerto ${taxaDeAcerto({ hits, lookups })} (${hits} acerto(s) em ${lookups} consulta(s)), ${stored} resposta(s) guardada(s).`,
    );
  });

  api.registerCommand("cache-limpar", () => {
    api.cache.clear();
    api.cache.notify("Cache de respostas esvaziado.");
    atualizarBloco();
  });
}
