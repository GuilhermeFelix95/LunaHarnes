import type { ChatMessage, ProviderEvent, ProviderKind } from "../types";

/// Última mensagem se for uma resposta de texto do assistente (não uma linha de ferramenta).
function lastTextReply(messages: ChatMessage[]): ChatMessage | undefined {
  const last = messages[messages.length - 1];
  return last?.role === "assistant" && !last.tool ? last : undefined;
}

/// Aplica um evento do provedor à lista de mensagens.
/// Deltas de texto anexam à última resposta; ferramentas viram linhas próprias.
/// `provider` e `agent` marcam as mensagens novas com o agente que respondeu (`agent` é o nome do perfil de API).
export function applyEvent(
  messages: ChatMessage[],
  event: ProviderEvent,
  provider?: ProviderKind,
  agent?: string,
): ChatMessage[] {
  const by = { ...(provider ? { provider } : {}), ...(agent ? { agent } : {}) };
  switch (event.kind) {
    case "textDelta": {
      const reply = lastTextReply(messages);
      if (reply) {
        return [...messages.slice(0, -1), { ...reply, text: reply.text + event.text }];
      }
      return [...messages, { role: "assistant", text: event.text, ...by }];
    }
    case "toolUse":
      return [
        ...messages,
        { role: "assistant", text: "", tool: { name: event.name, detail: event.detail }, ...by },
      ];
    case "error": {
      const reply = lastTextReply(messages);
      if (reply) {
        return [...messages.slice(0, -1), { ...reply, error: event.message }];
      }
      return [...messages, { role: "assistant", text: "", error: event.message, ...by }];
    }
    case "sessionStarted":
    case "done":
    case "rateLimit":
    case "context":
    case "cost":
    case "todos":
      // Não mudam a conversa: o ChatView usa para o medidor de uso e o painel de progresso.
      return messages;
  }
}
