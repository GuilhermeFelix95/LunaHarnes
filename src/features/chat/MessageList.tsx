import type { ChatMessage } from "../../types";
import { Markdown } from "./Markdown";

interface MessageListProps {
  messages: ChatMessage[];
  providerLabel: string;
}

/// Mensagens da conversa: usuário em balão, resposta em markdown sem balão, ferramentas em linha recolhível.
export function MessageList({ messages, providerLabel }: MessageListProps) {
  return (
    <ol className="messages" aria-live="polite">
      {messages.map((m, i) => (
        <li key={i} className={`message message--${m.role}`}>
          {m.role === "user" ? (
            <div className="message__bubble">{m.text}</div>
          ) : (
            <div className="message__reply">
              <span className="message__author">{providerLabel}</span>
              {m.tool && (
                <details className="tool-line">
                  <summary>
                    {m.tool.name}
                    {m.tool.detail && <span className="tool-line__preview"> · {m.tool.detail}</span>}
                  </summary>
                  <code>{m.tool.detail}</code>
                </details>
              )}
              {!m.tool && m.text && <Markdown text={m.text} />}
              {m.error && (
                <p role="alert" className="message__error">
                  {m.error}
                </p>
              )}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
