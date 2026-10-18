/// Modo plano: o agente entrevista, planeja e só depois edita. Vale para qualquer CLI,
/// porque o Codex não tem modo de plano próprio: a regra vai no prompt e a sandbox fica só leitura.
import type { Question } from "./questions";

/// Meta padrão: o plano só sai quando o agente diz que tem pelo menos este tanto do contexto.
export const DEFAULT_PLAN_TARGET = 80;
export const PLAN_TARGET_KEY = "luna.planTarget";

/// Meta de contexto (%) para montar o plano, escolhida em Configurações. Fora de 50–100, vale o padrão.
export function loadPlanTarget(): number {
  try {
    const saved = Number(localStorage.getItem(PLAN_TARGET_KEY));
    if (Number.isInteger(saved) && saved >= 50 && saved <= 100) return saved;
  } catch {
    // Armazenamento indisponível: usa o padrão.
  }
  return DEFAULT_PLAN_TARGET;
}

export function savePlanTarget(target: number) {
  try {
    localStorage.setItem(PLAN_TARGET_KEY, String(target));
  } catch {
    // Sem armazenamento, a meta vale só nesta sessão.
  }
}

export function planInstruction(target: number): string {
  return [
    "Você está no modo de planejamento. Até o usuário aprovar o plano, siga estas regras:",
    "1. Entenda o contexto com perguntas em rodadas numeradas, sempre no bloco luna-perguntas. Pergunte só o que não dá para descobrir lendo o código.",
    "2. Em toda resposta, escreva na primeira linha \"Contexto entendido: X%\", com X de 0 a 100: a parte do contexto que você já tem para montar o plano. Essa linha é obrigatória, mesmo quando há perguntas.",
    `3. Só apresente o plano quando o contexto entendido chegar a ${target}% ou mais. Abaixo disso, continue perguntando, sem escrever o plano.`,
    "4. Não altere arquivos nem execute comandos que modifiquem algo.",
    "5. Ao apresentar o plano, liste os arquivos a alterar e pergunte se pode aprovar, com o bloco de perguntas e as opções \"Aprovar e executar\" e \"Ainda não\".",
    "6. Só comece a executar depois que o usuário aprovar.",
  ].join("\n");
}

/// O texto que vira plano na aba Plano, ou null. Vale para a resposta sem perguntas e para a que pede aprovação
/// (a aprovação é a última pergunta do plano). Rodadas de perguntas não viram plano.
export function planFromReply(reply: { text: string; questions: Question[] | null }, planning: boolean): string | null {
  if (!planning || !reply.text.trim()) return null;
  const asksApproval = reply.questions?.some((q) => q.options.includes(APPROVE_OPTION)) ?? false;
  return !reply.questions || asksApproval ? reply.text : null;
}

/// Lê "Contexto entendido: X%" da resposta. Sem a linha, devolve null.
const UNDERSTOOD = /Contexto entendido:\s*(\d{1,3})\s*%/i;
export function contextUnderstood(text: string): number | null {
  const match = UNDERSTOOD.exec(text);
  return match ? Math.min(100, Number(match[1])) : null;
}

/// Opção que aprova o plano quando o agente pergunta pelo seletor. Escolhê-la encerra o planejamento.
export const APPROVE_OPTION = "Aprovar e executar";

/// Enviado quando o usuário aprova: o turno seguinte já sai do modo plano.
/// A spec segue o modelo to-spec do Matt Pocock: é o que o projeto é e as decisões tomadas, não o plano passo a passo.
export const APPROVAL_PROMPT = [
  "O plano foi aprovado. Antes de começar, crie um arquivo Markdown em spec/ na raiz do projeto (ex.: spec/<funcionalidade>.md) com a spec deste trabalho, nesta ordem de seções:",
  "## Problem Statement",
  "## Solution",
  "## User Stories",
  "## Implementation Decisions",
  "## Testing Decisions",
  "## Out of Scope",
  "## Further Notes",
  "Regras da spec: descreva decisões técnicas fixas do projeto (ex.: 'frontend em React', sem outro framework que não foi escolhido). Em Implementation Decisions, não coloque caminhos de arquivo nem trechos de código. Em Testing Decisions, só comportamento externo. Não copie o plano passo a passo.",
  "Antes de editar, crie uma tarefa (TaskCreate) para cada etapa do plano, na ordem. Ao começar uma etapa, marque-a como in_progress (TaskUpdate); ao terminar, marque-a como completed.",
  "Depois, execute o plano agora, editando os arquivos necessários, e resuma o que foi feito ao final.",
].join("\n");

/// Protocolo das perguntas: toda pergunta vai dentro do bloco, que o app mostra como seletor.
/// Sem o bloco, a pergunta apareceria como texto no chat, o que o usuário não quer.
export const QUESTION_PROTOCOL = [
  "Sempre que precisar perguntar algo ao usuário, escreva as perguntas somente dentro de um bloco de código chamado luna-perguntas, com um array JSON:",
  "```luna-perguntas",
  '[{"pergunta": "texto da pergunta", "opcoes": ["opção A", "opção B"], "recomendada": "opção A", "multipla": false}]',
  "```",
  "Cada pergunta tem de 2 a 6 opções. Use \"multipla\": true só quando mais de uma opção puder valer.",
  "\"recomendada\" é a opção que você recomenda, copiada exatamente de \"opcoes\". Sempre informe uma.",
  "Nunca escreva perguntas fora desse bloco.",
].join("\n");

export function withPlanInstruction(prompt: string, target = DEFAULT_PLAN_TARGET): string {
  return `${planInstruction(target)}\n\n${QUESTION_PROTOCOL}\n\n${prompt}`;
}
