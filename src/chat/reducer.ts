import type { ChatMessage, ProviderEvent } from "../types";

/// Aplica um evento do provedor à lista de mensagens.
/// Deltas de texto anexam à última mensagem do assistente.
export function applyEvent(
  messages: ChatMessage[],
  event: ProviderEvent,
): ChatMessage[] {
  switch (event.kind) {
    case "textDelta": {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        return [...messages.slice(0, -1), { ...last, text: last.text + event.text }];
      }
      return [...messages, { role: "assistant", text: event.text }];
    }
    case "error": {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        return [...messages.slice(0, -1), { ...last, error: event.message }];
      }
      return [...messages, { role: "assistant", text: "", error: event.message }];
    }
    case "sessionStarted":
    case "done":
      return messages;
  }
}
