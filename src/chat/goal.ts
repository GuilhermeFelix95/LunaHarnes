/// Modo /meta: o agente repete o pedido até cumprir a condição e sinaliza o fim com um marcador na última linha.
/// O marcador é retirado do texto exibido ao usuário.
export const MAX_GOAL_ROUNDS = 20;

export const GOAL_DONE_MARKER = "META_CONCLUIDA";

export function goalInstruction(condition: string): string {
  return [
    `Trabalhe até cumprir esta condição: ${condition}`,
    `Quando ela estiver cumprida de verdade, escreva ${GOAL_DONE_MARKER} sozinho na última linha da resposta.`,
    `Não escreva ${GOAL_DONE_MARKER} antes de terminar.`,
  ].join("\n");
}

export function isGoalDone(reply: string): boolean {
  const lines = reply.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines[lines.length - 1] === GOAL_DONE_MARKER;
}

export function stripGoalMarker(text: string): string {
  return text
    .split("\n")
    .filter((line) => line.trim() !== GOAL_DONE_MARKER)
    .join("\n")
    .trimEnd();
}

/// Depois de `roundsDone` rodadas, repete só se o agente não sinalizou o fim e o teto não foi atingido.
export function goalShouldContinue(reply: string, roundsDone: number): boolean {
  return !isGoalDone(reply) && roundsDone < MAX_GOAL_ROUNDS;
}
