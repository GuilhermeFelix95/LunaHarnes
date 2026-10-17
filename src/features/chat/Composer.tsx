import { useEffect, useRef, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import type { ModelOption, Permission } from "../../types";
import type { AgentOption } from "../../chat/agents";
import type { PluginMode } from "../../plugins/host";
import { PROVIDER_LABELS } from "../../chat/providers";
import { ModelMenu } from "./ModelMenu";

export { PROVIDER_LABELS };

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
  /** Agente da conversa (chave de chat/agents.ts). */
  agent: string;
  agents: AgentOption[];
  onAgent: (key: string) => void;
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
  /** Modos oferecidos por plugins. `mode` é o id ligado ou vazio; só um liga por vez. */
  modes: PluginMode[];
  mode: string;
  onMode: (id: string) => void;
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
            value={props.agent}
            disabled={running}
            onChange={(e) => props.onAgent(e.target.value)}
          >
            {props.agents.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
          <ModelMenu models={props.models} value={props.model} onChange={props.onModel} disabled={running} />
          <select
            aria-label="Esforço"
            value={props.effort}
            disabled={running || efforts.length === 0}
            onChange={(e) => props.onEffort(e.target.value)}
          >
            <option value="">Padrão</option>
            {efforts.map((level) => (
              <option key={level.id} value={level.id}>
                {level.recommended ? `${level.label} (recomendado)` : level.label}
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
          {props.modes.map((m) => (
            <button
              key={m.id}
              type="button"
              className="composer__mode"
              title={m.description}
              aria-pressed={props.mode === m.id}
              disabled={running}
              onClick={() => props.onMode(props.mode === m.id ? "" : m.id)}
            >
              {m.label}
            </button>
          ))}
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
              <Square size={12} fill="currentColor" aria-hidden="true" />
            </button>
          ) : (
            <button type="submit" className="composer__action" disabled={!canSend} aria-label="Enviar">
              <ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
