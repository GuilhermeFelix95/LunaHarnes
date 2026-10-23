import type { ChatMessage, ProviderEvent, ProviderKind } from "../types";

/// Última mensagem se for uma resposta de texto do assistente (não uma linha de ferramenta
/// nem o resultado de uma tarefa em segundo plano, que não pertence ao turno em andamento).
function lastTextReply(messages: ChatMessage[]): ChatMessage | undefined {
  const last = messages[messages.length - 1];
  return last?.role === "assistant" && !last.tool && !last.background ? last : undefined;
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
      return [...messages, { role: "assistant", text: event.text, at: Date.now(), ...by }];
    }
    case "toolUse":
      return [
        ...messages,
        { role: "assistant", text: "", tool: { id: event.id, name: event.name, detail: event.detail }, at: Date.now(), ...by },
      ];
    case "toolResult": {
      // Marca a ação que terminou; procura de trás para frente, onde ela costuma estar.
      if (!event.id) return messages;
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message.tool?.id === event.id) {
          return [...messages.slice(0, i), { ...message, tool: { ...message.tool, ok: event.ok } }, ...messages.slice(i + 1)];
        }
      }
      return messages;
    }
    case "toolDiff": {
      // Liga o diff à ação que editou o arquivo, procurando de trás para frente como o resultado.
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message.tool?.id === event.id) {
          return [...messages.slice(0, i), { ...message, tool: { ...message.tool, diff: event.diff } }, ...messages.slice(i + 1)];
        }
      }
      return messages;
    }
    case "error": {
      const reply = lastTextReply(messages);
      if (reply) {
        return [...messages.slice(0, -1), { ...reply, error: event.message }];
      }
      return [...messages, { role: "assistant", text: "", error: event.message, at: Date.now(), ...by }];
    }
    case "modelUsed": {
      // O modelo vai para a última resposta do assistente, que é a que o evento descreve.
      let index = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant" && !messages[i].background) {
          index = i;
          break;
        }
      }
      if (index < 0) return messages;
      return messages.map((m, i) => (i === index ? { ...m, model: event.model } : m));
    }
    case "sessionStarted":
    case "done":
    case "rateLimit":
    case "context":
    case "cacheUsage":
    case "outputTokens":
    case "cost":
    case "commandResult":
    case "todos":
    case "taskCreated":
    case "taskAssigned":
    case "taskUpdated":
      // Não mudam a conversa: o ChatView usa para o medidor de uso e o painel de progresso.
      return messages;
  }
}
