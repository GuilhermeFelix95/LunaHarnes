import { useEffect, useRef, type KeyboardEvent } from "react";
import type { ModelOption, Permission, ProviderKind } from "../../types";

export const PROVIDER_LABELS: Record<ProviderKind, string> = {
  claude: "Claude Code",
  codex: "Codex",
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  readOnly: "Só leitura",
  acceptEdits: "Aceitar edições",
  fullAccess: "Acesso total",
};

const MAX_HEIGHT_PX = 200;

interface ComposerProps {
  draft: string;
  onDraft: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  running: boolean;
  /** Desabilita o texto e o envio (ex.: conta não conectada). */
  blocked: boolean;
  provider: ProviderKind;
  onProvider: (provider: ProviderKind) => void;
  /** Provedor não troca depois da primeira mensagem: o id da conversa é do CLI. */
  providerLocked: boolean;
  permission: Permission;
  onPermission: (permission: Permission) => void;
  /** Modelos que a CLI do provedor lista. Vazio enquanto carrega. */
  models: ModelOption[];
  /** Valor vazio = padrão da CLI. */
  model: string;
  onModel: (model: string) => void;
  effort: string;
  onEffort: (effort: string) => void;
  planning: boolean;
  onTogglePlanning: () => void;
}

/// Caixa de mensagem com Enter para enviar, Shift+Enter para quebrar linha e os seletores embaixo.
export function Composer(props: ComposerProps) {
  const { draft, onDraft, onSend, onStop, running, blocked } = props;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const canSend = draft.trim().length > 0 && !blocked && !running;

  // Altura acompanha o texto até um limite; depois disso a área rola.
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [draft]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (canSend) onSend();
  }

  const selectedModel = props.models.find((m) => m.id === props.model);
  // Sem modelo escolhido, a CLI decide o esforço: o seletor fica desligado.
  const efforts = selectedModel?.efforts ?? [];

  return (
    <form
      className={`composer${props.planning ? " composer--planning" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (running) onStop();
        else if (canSend) onSend();
      }}
    >
      <textarea
        ref={textarea}
        aria-label="Mensagem"
        placeholder={props.planning ? "Descreva o que quer planejar…" : "Responda ou peça algo…"}
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={blocked}
        rows={1}
      />
      <div className="composer__footer">
        <div className="composer__selectors">
          <select
            aria-label="Provedor"
            value={props.provider}
            disabled={running || props.providerLocked}
            onChange={(e) => props.onProvider(e.target.value as ProviderKind)}
          >
            {(Object.keys(PROVIDER_LABELS) as ProviderKind[]).map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}
              </option>
            ))}
          </select>
          <select
            aria-label="Modelo"
            value={props.model}
            disabled={running}
            onChange={(e) => props.onModel(e.target.value)}
          >
            <option value="">Padrão da CLI</option>
            {props.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Esforço"
            value={props.effort}
            disabled={running || efforts.length === 0}
            onChange={(e) => props.onEffort(e.target.value)}
          >
            <option value="">Padrão</option>
            {efforts.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          <select
            aria-label="Permissão"
            value={props.permission}
            disabled={running}
            onChange={(e) => props.onPermission(e.target.value as Permission)}
          >
            {(Object.keys(PERMISSION_LABELS) as Permission[]).map((p) => (
              <option key={p} value={p}>
                {PERMISSION_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="composer__actions">
          <button
            type="button"
            className="composer__plan"
            aria-label="Modo de planejamento"
            aria-pressed={props.planning}
            disabled={running}
            onClick={props.onTogglePlanning}
          >
            Planejar
          </button>
          {running ? (
            <button type="submit" className="composer__action composer__action--stop" aria-label="Parar">
              ■
            </button>
          ) : (
            <button type="submit" className="composer__action" disabled={!canSend} aria-label="Enviar">
              ↑
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
