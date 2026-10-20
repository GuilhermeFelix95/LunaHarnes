import { useEffect, useState } from "react";
import { AlertCircle, Bot, Braces, Check, Copy, FilePen, FileText, Search, Sparkles, SquareTerminal, Undo2, Wrench, X, type LucideIcon } from "lucide-react";
import { PROVIDER_LABELS } from "../../chat/providers";
import type { ChatMessage, ProviderKind } from "../../types";
import { Markdown } from "./Markdown";
import { resolveLocale, t } from "../../i18n";

/// Avatar de cada agente: o ícone aparece ao lado do nome em cada resposta.
const PROVIDER_ICONS: Record<ProviderKind, LucideIcon> = { claude: Sparkles, codex: Bot, opencode: Braces };

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
  /** Etapa em andamento da lista de progresso, mostrada no cabeçalho do trabalho. */
  step?: string | null;
  /** Momento em que o turno começou, para o tempo decorrido no cabeçalho do trabalho. */
  startedAt?: number | null;
  /** Ctrl+clique num link da resposta: abre o endereço no navegador integrado. */
  onOpenLink?: (url: string) => void;
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
  | { kind: "reply"; provider: ProviderKind; label?: string; model?: string; cached?: boolean; parts: Part[] };

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
    // O modelo que respondeu: prova de qual papel do orquestrador rodou esta resposta.
    if (m.model) reply.model = m.model;
    if (m.cached) reply.cached = true;
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
  for (const tool of tools) counts.set(tool.name, (counts.get(tool.name) ?? 0) + 1);
  const names = [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(", ");
  return t("message.toolActions", { count: tools.length, names });
}

/// Tempo decorrido em "12 s" ou "1 min 5 s", atualizado a cada segundo enquanto o turno roda.
function useElapsed(since?: number | null): string | null {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!since) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [since]);
  if (!since) return null;
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} min ${seconds % 60} s` : `${seconds} s`;
}

/// Cabeçalho enquanto o agente trabalha: "Trabalhando · passo atual · tempo".
function WorkingHeader({ step, startedAt }: { step?: string | null; startedAt?: number | null }) {
  const elapsed = useElapsed(startedAt);
  return (
    <span className="tool-line__working">
      {t("message.working")}
      {step && <span className="tool-line__step"> · {step}</span>}
      {elapsed && <span className="tool-line__time"> · {elapsed}</span>}
    </span>
  );
}

/// Hora curta no formato do idioma da interface, ex.: 14:32.
function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString(resolveLocale(), { hour: "2-digit", minute: "2-digit" });
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
        <button type="button" className="message__action" aria-label={t("message.backToHere")} title={t("message.backToHere")} disabled={disabled} onClick={onRewind}>
          <Undo2 size={14} aria-hidden="true" />
        </button>
      )}
      <button type="button" className="message__action" aria-label={t("message.copyAria")} title={t("message.copy")} onClick={copy}>
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
export function MessageList({ messages, fallbackProvider, running, onRewind, pending, step, startedAt, onOpenLink }: MessageListProps) {
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
                {item.model && <span className="message__model">{item.model}</span>}
                {item.cached && <span className="message__cache">{t("message.cached")}</span>}
              </span>
              {item.parts.map((part, j) => {
                if (part.kind === "tools") {
                  const working = running && i === items.length - 1 && j === item.parts.length - 1;
                  return (
                    <details key={j} className="tool-line">
                      <summary>
                        {working ? (
                          <WorkingHeader step={step} startedAt={startedAt} />
                        ) : (
                          <span className="tool-line__preview">{toolSummary(part.tools)}</span>
                        )}
                      </summary>
                      <ul className="tool-line__list">
                        {part.tools.map((tool, k) => {
                          const Icon = toolIcon(tool.name);
                          return (
                            <li key={k}>
                              <span className="tool-line__name">
                                <Icon size={13} aria-hidden="true" />
                                {tool.name}
                                {tool.ok === true && (
                                  <span className="tool-line__status tool-line__status--ok" role="img" aria-label={t("message.toolOk")}>
                                    <Check size={12} aria-hidden="true" />
                                  </span>
                                )}
                                {tool.ok === false && (
                                  <span className="tool-line__status tool-line__status--failed" role="img" aria-label={t("message.toolFailed")}>
                                    <X size={12} aria-hidden="true" />
                                  </span>
                                )}
                              </span>
                              {tool.detail && <code>{tool.detail}</code>}
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
                    {m.text && <Markdown text={m.text} onOpenLink={onOpenLink} />}
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
              {t("message.thinking")}
            </p>
          </div>
        </li>
      )}
    </ol>
  );
}
