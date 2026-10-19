// LunaFix: plugin oficial, ativo por padrão. Quando um comando do agente falha, pede a correção antes de entregar a resposta.
// O limite de tentativas fica no app (AUTOFIX_MAX_ATTEMPTS): aqui basta decidir se há o que corrigir.

export function activate(api) {
  api.onTurnDone(({ lastCommand }) => {
    if (!lastCommand || lastCommand.ok) return undefined;
    return [
      "O último comando que você rodou falhou. Antes de dar a tarefa por pronta:",
      "1. Leia a saída do erro abaixo e corrija a causa.",
      "2. Rode o mesmo comando de novo e confirme que passa.",
      "3. Só então responda, dizendo o que mudou.",
      "",
      "Saída do comando:",
      "```",
      lastCommand.output,
      "```",
    ].join("\n");
  });
}
