// Cache de Tokens: liga o cache de respostas da sessão e oferece /cache e /cache-limpar.
// Os comandos mostram o resultado como aviso local, sem enviar nada ao agente.
/// <reference path="../luna-plugin.d.ts" />

export function activate(api) {
  api.cache.setEnabled(true);

  api.registerCommand("cache", (args) => {
    const acao = args.trim();
    if (acao === "ligar" || acao === "desligar") {
      api.cache.setEnabled(acao === "ligar");
      api.cache.notify(`Cache de respostas ${acao === "ligar" ? "ligado" : "desligado"}.`);
      return;
    }
    const { hits, stored } = api.cache.stats();
    api.cache.notify(`Cache de respostas: ${hits} acerto(s), ${stored} resposta(s) guardada(s).`);
  });

  api.registerCommand("cache-limpar", () => {
    api.cache.clear();
    api.cache.notify("Cache de respostas esvaziado.");
  });
}
