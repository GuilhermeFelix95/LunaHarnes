import { useEffect, useRef, type KeyboardEvent } from "react";
import type { Permission, ProviderKind } from "../../types";

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

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (running) onStop();
        else if (canSend) onSend();
      }}
    >
      <textarea
        ref={textarea}
        aria-label="Mensagem"
        placeholder="Responda ou peça algo…"
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
    </form>
  );
}
