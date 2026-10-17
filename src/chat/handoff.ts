import type { AgentSessions, ChangedFile, Changes, ChatMessage, ProviderKind } from "../types";
import { PROVIDER_LABELS } from "./providers";

/// Troca de agente no meio da conversa, sem perder contexto.
///
/// Cada agente mantém a própria sessão nativa (com as leituras e resultados de ferramenta que só ele viu).
/// O app é dono do histórico e manda a cada agente, em texto original, só o que ele ainda não viu.
/// O estado do trabalho vem do git, não da memória do modelo. Nada é resumido por modelo.

/** Tamanho máximo do contexto enviado (caracteres). Acima disso, respostas antigas são cortadas. */
export const HANDOFF_BUDGET = 120_000;
const OLD_REPLY_MAX = 1_500;
/** Últimas mensagens sempre enviadas inteiras. */
const KEEP_RECENT = 4;
const TRIMMED = "[resposta resumida pelo app]";

const STATUS_LABELS: Record<ChangedFile["status"], string> = {
  added: "adicionado",
  modified: "modificado",
  deleted: "removido",
  renamed: "renomeado",
  untracked: "novo",
};

function block(m: ChatMessage, fallback: ProviderKind): string {
  if (m.role === "user") return `### Você\n${m.text}`;
  const author = PROVIDER_LABELS[m.provider ?? fallback];
  if (m.tool) return `- Ferramenta (${author}): ${m.tool.name}${m.tool.detail ? ` · ${m.tool.detail}` : ""}`;
  const error = m.error ? `\n(erro: ${m.error})` : "";
  return `### ${author}\n${m.text}${error}`;
}

/// Histórico em texto, com autor de cada mensagem. Acima do limite, corta respostas antigas do agente;
/// mensagens do usuário e as mais recentes ficam inteiras.
export function renderHistory(messages: ChatMessage[], fallback: ProviderKind, budget = HANDOFF_BUDGET): string {
  const blocks = messages.map((m) => block(m, fallback));
  let size = blocks.reduce((sum, b) => sum + b.length + 2, 0);

  for (let i = 0; i < messages.length - KEEP_RECENT && size > budget; i++) {
    const m = messages[i];
    if (m.role !== "assistant" || m.tool || m.text.length <= OLD_REPLY_MAX) continue;
    const trimmed = block({ ...m, text: `${m.text.slice(0, OLD_REPLY_MAX)}… ${TRIMMED}` }, fallback);
    size -= blocks[i].length - trimmed.length;
    blocks[i] = trimmed;
  }
  return blocks.join("\n\n");
}

function renderChanges(changes: Changes | null): string {
  if (!changes) return "";
  if (!changes.isRepo) return "Estado do repositório: a pasta não é um repositório git.";
  if (changes.files.length === 0) return "Estado do repositório: nenhuma alteração pendente no git.";
  const lines = changes.files.map((f) => {
    const counts = f.additions === null ? "" : `, +${f.additions} −${f.deletions ?? 0}`;
    return `- ${f.path} (${STATUS_LABELS[f.status]}${counts})`;
  });
  return `Estado do repositório (alterações pendentes no git):\n${lines.join("\n")}`;
}

interface ContextInput {
  sessions: AgentSessions;
  /** Agente que vai responder agora. */
  target: ProviderKind;
  /** Mensagens anteriores à nova mensagem do usuário. */
  history: ChatMessage[];
  /** Autor das respostas antigas que não têm `provider`. */
  fallback: ProviderKind;
  cwd: string;
  changes: Changes | null;
}

/// Decide a sessão a retomar e o contexto que vai antes da nova mensagem.
export function contextFor({ sessions, target, history, fallback, cwd, changes }: ContextInput): {
  sessionId?: string;
  preamble?: string;
} {
  const session = sessions[target];
  const unseen = history.slice(session?.seen ?? 0);
  if (unseen.length === 0) return { sessionId: session?.id, preamble: undefined };

  const intro = session
    ? `Enquanto você esteve fora desta conversa, o usuário continuou com outro agente. Estas são as mensagens que você não viu:`
    : `Você está assumindo uma conversa em andamento, que começou com outro agente. Pasta de trabalho: ${cwd}\nHistórico completo até aqui:`;
  const parts = [
    intro,
    renderHistory(unseen, fallback),
    renderChanges(changes),
    "Releia os arquivos antes de editá-los: o conteúdo que o outro agente leu não está aqui. Continue de onde a conversa parou.",
  ].filter(Boolean);
  return { sessionId: session?.id, preamble: parts.join("\n\n") };
}

/// Junta o contexto e a mensagem que a CLI recebe.
export function withContext(preamble: string | undefined, prompt: string): string {
  return preamble ? `${preamble}\n\n---\nNova mensagem do usuário:\n${prompt}` : prompt;
}
