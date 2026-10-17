// Modo Ask: o agente só conversa e explica. O modo força a leitura (nada é alterado)
// e acrescenta uma instrução ao pedido. A permissão "modes" só restringe, nunca amplia.
export function activate(api) {
  api.registerMode({
    id: "ask",
    label: "Perguntar",
    description: "Só conversa: explica e responde, sem editar arquivos nem rodar comandos que alterem algo.",
    instruction:
      "Modo Perguntar: responda só com explicações e perguntas. Não edite nem crie arquivos e não execute comandos que alterem o projeto ou o sistema. Se for preciso mudar algo, descreva o que faria e pergunte antes.",
    permission: "readOnly",
  });
}
