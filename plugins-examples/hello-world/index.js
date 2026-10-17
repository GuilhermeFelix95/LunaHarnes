// Plugin de referência: mostra os dois pontos de extensão do MVP.
// Copie esta pasta para <app_data>/plugins/hello-world para testar.

export function activate(api) {
  // `/ola <texto>` envia uma saudação ao provedor, sem precisar digitar o pedido completo.
  api.registerCommand("ola", (args) =>
    args ? `Cumprimente ${args} em português do Brasil, em uma frase.` : "Cumprimente em português do Brasil, em uma frase.",
  );

  // Antes de cada envio, acrescenta uma instrução de idioma ao pedido.
  api.onBeforeSend((prompt) => `Responda em português do Brasil.\n\n${prompt}`);
}
