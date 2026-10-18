/// Perguntas do agente: vêm num bloco `luna-perguntas` com um array JSON, e viram um seletor em vez de texto no chat.
/// Assim a pergunta tem as mesmas opções em qualquer motor, sem depender de ferramenta própria de cada CLI.

export interface Question {
  question: string;
  options: string[];
  multiple: boolean;
}

export interface ReplyParts {
  /** Texto da resposta sem o bloco de perguntas. */
  text: string;
  /** Perguntas válidas, ou `null` quando não há bloco ou ele está malformado. */
  questions: Question[] | null;
  /** Aviso para o usuário quando o bloco existe mas não pode ser usado. */
  warning?: string;
}

const BLOCK = /```luna-perguntas\s*\n([\s\S]*?)\n```/;
const MAX_OPTIONS = 6;
const MALFORMED = "As perguntas vieram num formato inválido. Elas aparecem como texto abaixo.";

/// Separa o bloco de perguntas da explicação. Sem bloco, devolve a resposta inteira.
export function extractQuestions(reply: string): ReplyParts {
  const match = BLOCK.exec(reply);
  if (!match) return { text: reply, questions: null };

  let raw: unknown;
  try {
    raw = JSON.parse(match[1]);
  } catch {
    return { text: reply, questions: null, warning: MALFORMED };
  }
  const questions = parseQuestions(raw);
  if (!questions) return { text: reply, questions: null, warning: MALFORMED };
  return { text: reply.replace(BLOCK, "").trim(), questions };
}

/// Confere a forma do JSON: uma lista de perguntas, cada uma com 2 a 6 opções em texto.
function parseQuestions(raw: unknown): Question[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const questions: Question[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { pergunta, opcoes, multipla } = item as Record<string, unknown>;
    if (typeof pergunta !== "string" || !pergunta.trim()) return null;
    if (!Array.isArray(opcoes) || opcoes.length < 2 || opcoes.length > MAX_OPTIONS) return null;
    if (!opcoes.every((option) => typeof option === "string" && option.trim())) return null;
    questions.push({
      question: pergunta.trim(),
      options: (opcoes as string[]).map((option) => option.trim()),
      multiple: multipla === true,
    });
  }
  return questions;
}
