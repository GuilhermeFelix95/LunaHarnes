/// Modo plano: o agente entrevista, planeja e só depois edita. Vale para qualquer CLI,
/// porque o Codex não tem modo de plano próprio: a regra vai no prompt e a sandbox fica só leitura.
export const PLAN_INSTRUCTION = [
  "Você está no modo de planejamento. Até o usuário aprovar o plano, siga estas regras:",
  "1. Entenda o contexto com perguntas em rodadas numeradas, sempre no bloco luna-perguntas. Pergunte só o que não dá para descobrir lendo o código.",
  "2. Cada pergunta traz a sua resposta recomendada, numa linha separada.",
  "3. Não altere arquivos nem execute comandos que modifiquem algo.",
  "4. Só quando tiver entendido o contexto e não houver perguntas em aberto, apresente o plano com os arquivos a alterar e pergunte se pode aprovar. Enquanto houver perguntas, não escreva o plano. Para pedir aprovação, faça uma pergunta no bloco com as opções \"Aprovar e executar\" e \"Ainda não\".",
  "5. Só comece a executar depois que o usuário aprovar.",
].join("\n");

/// Gerar spec (estilo to-spec): sintetiza a conversa, sem perguntas novas. A resposta vira o plano no painel.
export const SPEC_INSTRUCTION = [
  "Sintetize a conversa até agora numa spec, sem fazer novas perguntas e sem alterar arquivos.",
  "Use estas seções, nesta ordem, em Markdown:",
  "## Problem Statement",
  "## Solution",
  "## User Stories",
  "## Implementation Decisions",
  "## Testing Decisions",
  "## Out of Scope",
  "## Further Notes",
].join("\n");

/// Opção que aprova o plano quando o agente pergunta pelo seletor. Escolhê-la encerra o planejamento.
export const APPROVE_OPTION = "Aprovar e executar";

/// Enviado quando o usuário aprova: o turno seguinte já sai do modo plano.
export const APPROVAL_PROMPT = [
  "O plano foi aprovado. Antes de começar, crie a pasta spec/ na raiz do projeto com arquivos .md técnicos que descrevam o que o app é: stack, frontend, backend, dados e as decisões já tomadas (ex.: 'frontend em React', sem outro framework que não foi escolhido). Não copie o plano: a spec é a descrição técnica do produto.",
  "Depois, execute o plano agora, editando os arquivos necessários, e resuma o que foi feito ao final.",
].join(" ");

/// Protocolo das perguntas: toda pergunta vai dentro do bloco, que o app mostra como seletor.
/// Sem o bloco, a pergunta apareceria como texto no chat, o que o usuário não quer.
export const QUESTION_PROTOCOL = [
  "Sempre que precisar perguntar algo ao usuário, escreva as perguntas somente dentro de um bloco de código chamado luna-perguntas, com um array JSON:",
  "```luna-perguntas",
  '[{"pergunta": "texto da pergunta", "opcoes": ["opção A", "opção B"], "multipla": false}]',
  "```",
  "Cada pergunta tem de 2 a 6 opções. Use \"multipla\": true só quando mais de uma opção puder valer.",
  "Nunca escreva perguntas fora desse bloco.",
].join("\n");

export function withPlanInstruction(prompt: string): string {
  return `${PLAN_INSTRUCTION}\n\n${QUESTION_PROTOCOL}\n\n${prompt}`;
}
