import type { ChatMessage, ProviderEvent } from "../types";

/// Última mensagem se for uma resposta de texto do assistente (não uma linha de ferramenta).
function lastTextReply(messages: ChatMessage[]): ChatMessage | undefined {
  const last = messages[messages.length - 1];
  return last?.role === "assistant" && !last.tool ? last : undefined;
}

/// Aplica um evento do provedor à lista de mensagens.
/// Deltas de texto anexam à última resposta; ferramentas viram linhas próprias.
export function applyEvent(
  messages: ChatMessage[],
  event: ProviderEvent,
): ChatMessage[] {
  switch (event.kind) {
    case "textDelta": {
      const reply = lastTextReply(messages);
      if (reply) {
        return [...messages.slice(0, -1), { ...reply, text: reply.text + event.text }];
      }
      return [...messages, { role: "assistant", text: event.text }];
    }
    case "toolUse":
      return [
        ...messages,
        { role: "assistant", text: "", tool: { name: event.name, detail: event.detail } },
      ];
    case "error": {
      const reply = lastTextReply(messages);
      if (reply) {
        return [...messages.slice(0, -1), { ...reply, error: event.message }];
      }
      return [...messages, { role: "assistant", text: "", error: event.message }];
    }
    case "sessionStarted":
    case "done":
      return messages;
  }
}
