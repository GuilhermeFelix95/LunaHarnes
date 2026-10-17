/// Modo plano: o agente entrevista, planeja e só depois edita. Vale para qualquer CLI,
/// porque o Codex não tem modo de plano próprio: a regra vai no prompt e a sandbox fica só leitura.
export const PLAN_INSTRUCTION = [
  "Você está no modo de planejamento. Até o usuário aprovar o plano, siga estas regras:",
  "1. Entenda o contexto com perguntas em rodadas numeradas. Pergunte só o que não dá para descobrir lendo o código.",
  "2. Cada pergunta traz a sua resposta recomendada, numa linha separada.",
  "3. Não altere arquivos nem execute comandos que modifiquem algo.",
  "4. Quando tiver contexto suficiente, apresente o plano com os arquivos a alterar e pergunte se pode aprovar.",
  "5. Só comece a executar depois que o usuário aprovar.",
].join("\n");

/// Enviado quando o usuário aprova: o turno seguinte já sai do modo plano.
export const APPROVAL_PROMPT =
  "O plano foi aprovado. Execute-o agora, editando os arquivos necessários, e resuma o que foi feito ao final.";

export function withPlanInstruction(prompt: string): string {
  return `${PLAN_INSTRUCTION}\n\n${prompt}`;
}
