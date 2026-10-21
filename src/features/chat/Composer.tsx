import { useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { ArrowUp, Gauge, Paperclip, Square, Target, X } from "lucide-react";
import type { Account, ModelOption, Permission } from "../../types";
import type { AgentOption } from "../../chat/agents";
import type { PluginMode } from "../../plugins/host";
import { PROVIDER_LABELS } from "../../chat/providers";
import type { SlashItem, SlashOrigin } from "../../chat/slash";
import { t, type MessageKey } from "../../i18n";
import { ModelMenu } from "./ModelMenu";
import { Select } from "./Select";

export { PROVIDER_LABELS };

/// Nome de cada permissão no seletor, traduzido pela chave.
export const PERMISSION_KEYS: Record<Permission, MessageKey> = {
  readOnly: "composer.permission.readOnly",
  acceptEdits: "composer.permission.acceptEdits",
  fullAccess: "composer.permission.fullAccess",
};

/// O Cline e o Hermes só rodam com acesso total neste app. Mostrar só o que eles cumprem.
export function permissionOptions(engine?: string) {
  const allowed = (Object.keys(PERMISSION_KEYS) as Permission[]).filter((p) => (engine !== "cline" && engine !== "hermes") || p === "fullAccess");
  return allowed.map((p) => ({ value: p, label: t(PERMISSION_KEYS[p]) }));
}

/// Nome de cada origem no menu de `/`, traduzido pela chave.
const ORIGIN_KEYS: Record<SlashOrigin, MessageKey> = {
  luna: "slash.origin.luna",
  plugin: "slash.origin.plugin",
  skill: "slash.origin.skill",
  command: "slash.origin.command",
};

const MAX_HEIGHT_PX = 200;

/// Ponte para a conversa pôr texto no campo (sugestão, comando ou arquivo escolhido, volta no tempo).
export interface ComposerHandle {
  setValue(value: string): void;
}

interface ComposerProps {
  /** Recebe cada tecla digitada. O texto em si fica no composer. */
  onDraft: (value: string) => void;
  composerRef?: Ref<ComposerHandle>;
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
  /** Modo /meta: vale só para a próxima mensagem. */
  goalOn?: boolean;
  onToggleGoal?: () => void;
  /** Tokens por segundo estimados da resposta em curso. Null = não mostra. */
  speed?: number | null;
  /** Opção de ver a velocidade durante a resposta. */
  showSpeed?: boolean;
  onToggleSpeed?: () => void;
  /** Imagens anexadas (miniaturas) e os gestos para anexar e tirar. */
  attachments?: { id: number; url: string }[];
  onAttach?: (file: File) => void;
  onRemoveAttachment?: (id: number) => void;
  /** Arquivos gerais anexados (não imagem): só o nome aparece; o agente lê pelo caminho no envio. */
  fileAttachments?: { id: number; name: string }[];
  onRemoveFileAttachment?: (id: number) => void;
  /** Sugestões do @arquivo, já filtradas. Vazio = nenhum @ aberto. */
  files?: string[];
  onPickFile?: (path: string) => void;
  /** Modos oferecidos por plugins. `mode` é o id ligado ou vazio; só um liga por vez. */
  modes: PluginMode[];
  mode: string;
  onMode: (id: string) => void;
  /** Itens do menu de `/` já filtrados. Vazio = menu fechado. */
  slash?: SlashItem[];
  onPickSlash?: (item: SlashItem) => void;
  /** Seletor de conta extra: só aparece quando o motor da conversa tem contas (Claude e Codex). */
  accountsEnabled?: boolean;
  /** Contas extras do motor da conversa. */
  accounts?: Account[];
  /** Id da conta escolhida. Vazio = conta padrão da CLI. */
  account?: string;
  onAccount?: (id: string) => void;
}

/// Caixa de mensagem com Enter para enviar, Shift+Enter para quebrar linha e os seletores embaixo.
export function Composer(props: ComposerProps) {
  const { onDraft, onSend, onStop, running, blocked } = props;
  const [draft, setDraft] = useState("");
  useImperativeHandle(props.composerRef, () => ({ setValue: setDraft }), []);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const hasAttachments = (props.attachments?.length ?? 0) + (props.fileAttachments?.length ?? 0) > 0;
  const canSend = (draft.trim().length > 0 || hasAttachments) && !blocked && !running;
  const fileInput = useRef<HTMLInputElement>(null);

  // Altura acompanha o texto até um limite; depois disso a área rola.
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [draft]);

  // Item destacado do menu de `/`; volta ao primeiro quando a lista muda.
  const [slashIndex, setSlashIndex] = useState(0);
  const slash = props.slash ?? [];
  const active = Math.min(slashIndex, Math.max(slash.length - 1, 0));
  useEffect(() => setSlashIndex(0), [draft]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return;
    if (slash.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setSlashIndex((active + step + slash.length) % slash.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        props.onPickSlash?.(slash[active]);
        return;
      }
    }
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (canSend) onSend();
  }

  const selectedModel = props.models.find((m) => m.id === props.model);
  // Sem modelo escolhido, a CLI decide o esforço: o seletor fica desligado.
  const efforts = selectedModel?.efforts ?? [];


  return (
    <form
      className={`composer${props.planning ? " composer--planning" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const images = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
        if (images.length === 0) return;
        e.preventDefault();
        images.forEach((file) => props.onAttach?.(file));
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (running) onStop();
        else if (canSend) onSend();
      }}
    >
      <div data-plugin-slot="composer" />
      {slash.length > 0 && (
        <ul className="composer__files" role="listbox" aria-label={t("composer.commandsAria")}>
          {slash.map((item, index) => (
            <li key={`${item.origin}-${item.name}`}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setSlashIndex(index)}
                onClick={() => props.onPickSlash?.(item)}
              >
                <strong>/{item.name}</strong> {item.description}{" "}
                <span className="qpick__badge">{t(ORIGIN_KEYS[item.origin])}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {(props.files ?? []).length > 0 && (
        <ul className="composer__files" role="listbox" aria-label={t("composer.projectFilesAria")}>
          {(props.files ?? []).map((path) => (
            <li key={path}>
              <button type="button" role="option" aria-selected={false} onClick={() => props.onPickFile?.(path)}>
                {path}
              </button>
            </li>
          ))}
        </ul>
      )}
      {(props.attachments ?? []).length > 0 && (
        <ul className="composer__attachments" aria-label={t("composer.imagesAria")}>
          {(props.attachments ?? []).map((a) => (
            <li key={a.id}>
              <img src={a.url} alt={t("composer.imageAlt")} />
              <button
                type="button"
                aria-label={t("composer.removeImage")}
                onClick={() => props.onRemoveAttachment?.(a.id)}
                disabled={running}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {(props.fileAttachments ?? []).length > 0 && (
        <ul className="composer__attachments composer__attachments--files" aria-label={t("composer.filesAria")}>
          {(props.fileAttachments ?? []).map((f) => (
            <li key={f.id} className="composer__file">
              <Paperclip size={12} aria-hidden="true" />
              <span>{f.name}</span>
              <button
                type="button"
                aria-label={t("composer.removeFile")}
                onClick={() => props.onRemoveFileAttachment?.(f.id)}
                disabled={running}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={textarea}
        aria-label={t("composer.messageAria")}
        placeholder={props.planning ? t("composer.placeholderPlan") : t("composer.placeholderChat")}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onDraft(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onPaste={(e) => {
          const images = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
          if (images.length === 0) return;
          e.preventDefault();
          images.forEach((file) => props.onAttach?.(file));
        }}
        disabled={blocked}
        rows={1}
      />
      <div className="composer__footer">
        <div className="composer__selectors">
          <Select
            label={t("composer.provider")}
            value={props.agent}
            options={props.agents.map((a) => ({ value: a.key, label: a.label }))}
            onChange={props.onAgent}
            disabled={running}
          />
          <ModelMenu models={props.models} value={props.model} onChange={props.onModel} disabled={running} />
          <Select
            label={t("composer.effort")}
            value={props.effort}
            options={[
              { value: "", label: t("composer.effortDefault") },
              ...efforts.map((level) => ({
                value: level.id,
                label: level.recommended ? t("composer.recommended", { label: level.label }) : level.label,
              })),
            ]}
            onChange={props.onEffort}
            disabled={running || efforts.length === 0}
          />
          {props.accountsEnabled && (
            <Select
              label={t("composer.account")}
              value={props.account ?? ""}
              options={[
                { value: "", label: t("composer.accountDefault") },
                ...(props.accounts ?? []).map((a) => ({ value: a.id, label: a.name })),
              ]}
              onChange={(value) => props.onAccount?.(value)}
              disabled={running}
            />
          )}
          <Select
            label={t("composer.permission")}
            value={props.permission}
            options={permissionOptions(props.agents.find((a) => a.key === props.agent)?.engine)}
            onChange={(value) => props.onPermission(value as Permission)}
            disabled={running}
          />
        </div>
        {props.showSpeed && running && props.speed != null && (
          <span className="composer__speed" title={t("composer.speedTitle")}>
            {t("composer.speed", { speed: props.speed })}
          </span>
        )}
        <div className="composer__actions">
          <button
            type="button"
            className="composer__attach"
            aria-label={t("composer.attach")}
            title={t("composer.attach")}
            disabled={running || blocked}
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip size={16} aria-hidden="true" />
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              for (const file of Array.from(e.target.files ?? [])) props.onAttach?.(file);
              e.target.value = "";
            }}
          />
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
            aria-label={t("composer.planningAria")}
            aria-pressed={props.planning}
            disabled={running}
            onClick={props.onTogglePlanning}
          >
            {t("composer.plan")}
          </button>
          <button
            type="button"
            className="composer__goal"
            aria-label={t("composer.goalAria")}
            title={t("composer.goalAria")}
            aria-pressed={props.goalOn ?? false}
            disabled={running}
            onClick={props.onToggleGoal}
          >
            <Target size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="composer__speed-toggle"
            aria-label={t("composer.speedAria")}
            title={t("composer.speedAria")}
            aria-pressed={props.showSpeed ?? false}
            onClick={props.onToggleSpeed}
          >
            <Gauge size={16} aria-hidden="true" />
          </button>
          {running ? (
            <button type="submit" className="composer__action composer__action--stop" aria-label={t("composer.stop")}>
              <Square size={12} fill="currentColor" aria-hidden="true" />
            </button>
          ) : (
            <button type="submit" className="composer__action" disabled={!canSend} aria-label={t("composer.send")}>
              <ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
