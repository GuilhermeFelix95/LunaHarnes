import { useState } from "react";
import { AlertCircle, Bot, Check, Copy, FilePen, FileText, Search, Sparkles, SquareTerminal, Undo2, Wrench, type LucideIcon } from "lucide-react";
import { PROVIDER_LABELS } from "../../chat/providers";
import type { ChatMessage, ProviderKind } from "../../types";
import { Markdown } from "./Markdown";

/// Avatar de cada agente: o ícone aparece ao lado do nome em cada resposta.
const PROVIDER_ICONS: Record<ProviderKind, LucideIcon> = { claude: Sparkles, codex: Bot };

function ProviderIcon({ provider }: { provider: ProviderKind }) {
  const Icon = PROVIDER_ICONS[provider];
  return <Icon size={13} />;
}

interface MessageListProps {
  messages: ChatMessage[];
  /** Autor das respostas antigas, salvas antes de cada mensagem guardar o agente. */
  fallbackProvider: ProviderKind;
  /** Resposta em andamento: a última linha de ferramentas mostra "Trabalhando…". */
  running: boolean;
  /** Volta a conversa e os arquivos ao ponto deste pedido (só mensagens do usuário com checkpoint). */
  onRewind?: (message: ChatMessage) => void;
  /** Agente que está respondendo: autor do indicador "Pensando…" enquanto a resposta não chega. */
  pending?: { provider: ProviderKind; label: string };
}

type Tool = NonNullable<ChatMessage["tool"]>;

/// Ícone de cada tipo de ferramenta, para a linha recolhida ficar fácil de ler.
const TOOL_ICONS: Record<string, LucideIcon> = {
  Bash: SquareTerminal,
  Edit: FilePen,
  MultiEdit: FilePen,
  Write: FilePen,
  Read: FileText,
  Grep: Search,
  Glob: Search,
};

function toolIcon(name: string): LucideIcon {
  return TOOL_ICONS[name] ?? Wrench;
}

/** Pedaço de uma resposta: ferramentas seguidas viram um grupo; texto e erro ficam como estão. */
type Part = { kind: "tools"; tools: Tool[] } | { kind: "text"; message: ChatMessage };

type Item =
  | { kind: "user"; message: ChatMessage }
  | { kind: "reply"; provider: ProviderKind; label?: string; parts: Part[] };

/// Agrupa as mensagens do agente entre duas mensagens do usuário numa resposta só.
function group(messages: ChatMessage[], fallback: ProviderKind): Item[] {
  const items: Item[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      items.push({ kind: "user", message: m });
      continue;
    }
    let reply = items.at(-1);
    if (reply?.kind !== "reply") {
      reply = { kind: "reply", provider: m.provider ?? fallback, parts: [] };
      items.push(reply);
    }
    // Resposta de perfil de API: o nome do perfil aparece no lugar do nome do CLI.
    if (m.agent) reply.label = m.agent;
    const last = reply.parts.at(-1);
    if (m.tool && !m.error) {
      if (last?.kind === "tools") last.tools.push(m.tool);
      else reply.parts.push({ kind: "tools", tools: [m.tool] });
    } else {
      reply.parts.push({ kind: "text", message: m });
    }
  }
  return items;
}

/// "3 ações · Bash, Write ×2", ou o comando direto quando é uma ação só.
function toolSummary(tools: Tool[]): string {
  if (tools.length === 1) {
    const [only] = tools;
    return only.detail ? `${only.name} · ${only.detail}` : only.name;
  }
  const counts = new Map<string, number>();
  for (const t of tools) counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
  const names = [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(", ");
  return `${tools.length} ações · ${names}`;
}

/// Hora curta no formato do usuário, ex.: 14:32.
function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/// Barra de ações sob a mensagem: voltar (quando há checkpoint), copiar e a hora.
function MessageActions({ text, at, onRewind, disabled }: { text: string; at?: number; onRewind?: () => void; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="message__actions">
      {onRewind && (
        <button type="button" className="message__action" aria-label="Voltar até aqui" title="Voltar até aqui" disabled={disabled} onClick={onRewind}>
          <Undo2 size={14} aria-hidden="true" />
        </button>
      )}
      <button type="button" className="message__action" aria-label="Copiar mensagem" title="Copiar" onClick={copy}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </button>
      {at !== undefined && (
        <time className="message__time" dateTime={new Date(at).toISOString()}>
          {formatTime(at)}
        </time>
      )}
    </div>
  );
}

/// Ações da resposta: copia o texto dela inteiro e mostra a hora da última parte de texto.
function ReplyActions({ parts }: { parts: Part[] }) {
  const texts = parts.flatMap((p) => (p.kind === "text" && p.message.text ? [p.message] : []));
  if (texts.length === 0) return null;
  return <MessageActions text={texts.map((m) => m.text).join("\n\n")} at={texts.at(-1)?.at} />;
}

/// Mensagens da conversa: usuário em balão; cada resposta do agente com o nome uma vez,
/// ferramentas recolhidas e o texto em destaque.
export function MessageList({ messages, fallbackProvider, running, onRewind, pending }: MessageListProps) {
  const items = group(messages, fallbackProvider);
  // Pedido enviado e nenhuma resposta ainda: o agente aparece "pensando" até o primeiro pedaço chegar.
  const waiting = running && items.at(-1)?.kind === "user";

  return (
    <ol className="messages" aria-live="polite">
      {items.map((item, i) => (
        <li key={i} className={`message message--${item.kind === "user" ? "user" : "assistant"}`}>
          {item.kind === "user" ? (
            <div className="message__user">
              <div className="message__bubble">{item.message.text}</div>
              <MessageActions
                text={item.message.text}
                at={item.message.at}
                disabled={running}
                onRewind={onRewind && item.message.checkpoint ? () => onRewind(item.message) : undefined}
              />
            </div>
          ) : (
            <div className="message__reply">
              <span className="message__author">
                <span className="message__avatar" aria-hidden="true">
                  <ProviderIcon provider={item.provider} />
                </span>
                {item.label ?? PROVIDER_LABELS[item.provider]}
              </span>
              {item.parts.map((part, j) => {
                if (part.kind === "tools") {
                  const working = running && i === items.length - 1 && j === item.parts.length - 1;
                  return (
                    <details key={j} className="tool-line">
                      <summary>
                        {working && <span className="tool-line__working">Trabalhando… </span>}
                        <span className="tool-line__preview">{toolSummary(part.tools)}</span>
                      </summary>
                      <ul className="tool-line__list">
                        {part.tools.map((t, k) => {
                          const Icon = toolIcon(t.name);
                          return (
                            <li key={k}>
                              <span className="tool-line__name">
                                <Icon size={13} aria-hidden="true" />
                                {t.name}
                              </span>
                              {t.detail && <code>{t.detail}</code>}
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  );
                }
                const m = part.message;
                return (
                  <div key={j}>
                    {m.text && <Markdown text={m.text} />}
                    {m.error && (
                      <p role="alert" className="notice">
                        <AlertCircle size={15} aria-hidden="true" />
                        <span>{m.error}</span>
                      </p>
                    )}
                  </div>
                );
              })}
              <ReplyActions parts={item.parts} />
            </div>
          )}
        </li>
      ))}

      {waiting && (
        <li className="message message--assistant">
          <div className="message__reply">
            <span className="message__author">
              <span className="message__avatar" aria-hidden="true">
                <ProviderIcon provider={pending?.provider ?? fallbackProvider} />
              </span>
              {pending?.label ?? PROVIDER_LABELS[pending?.provider ?? fallbackProvider]}
            </span>
            <p className="typing" role="status">
              <span className="typing__dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              Pensando…
            </p>
          </div>
        </li>
      )}
    </ol>
  );
}
