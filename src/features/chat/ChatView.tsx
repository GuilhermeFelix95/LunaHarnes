import { useEffect, useRef, useState } from "react";
import {
  cancelPrompt,
  checkAuth,
  getWorkspace,
  listModels,
  onProviderEvent,
  openLogin,
  pickWorkspace,
  sendPrompt,
} from "../../api";
import { APPROVAL_PROMPT, withPlanInstruction } from "../../chat/planning";
import { applyEvent } from "../../chat/reducer";
import { PluginHost } from "../../plugins/host";
import { loadInstalledPlugins } from "../../plugins/loader";
import type { ChatMessage, Conversation, ModelOption, Permission, ProviderKind } from "../../types";
import { ChangesPanel } from "../changes/ChangesPanel";
import { LoginPrompt } from "../auth/LoginPrompt";
import { TerminalPanel } from "../terminal/TerminalPanel";
import { Composer, PROVIDER_LABELS } from "./Composer";
import { MessageList } from "./MessageList";
import { UsageMeter, type LimitState, type ContextState } from "./UsageMeter";
import { WorkspaceChip } from "./WorkspaceChip";

const TITLE_MAX_CHARS = 60;

interface ChatViewProps {
  /** Conversa aberta do histórico. Ausente = conversa nova. */
  initial?: Conversation;
  /** Pasta de uma conversa nova. Ausente = pasta de onde o luna foi rodado. */
  startCwd?: string;
  /** Pastas de conversas anteriores, para o menu de troca. */
  recentFolders?: string[];
  /** Chamado ao fim de cada turno, com a conversa inteira, para salvar em disco. */
  onPersist: (conversation: Conversation) => void;
}

export function ChatView({ initial, startCwd, recentFolders = [], onPersist }: ChatViewProps) {
  const [conversationId] = useState(() => initial?.id ?? crypto.randomUUID());
  const createdAt = useRef(initial?.createdAt ?? Date.now());

  const [provider, setProvider] = useState<ProviderKind>(initial?.provider ?? "claude");
  const [permission, setPermission] = useState<Permission>(initial?.permission ?? "acceptEdits");
  const [cwd, setCwd] = useState(initial?.cwd ?? startCwd ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [effort, setEffort] = useState(initial?.effort ?? "");
  const [planning, setPlanning] = useState(initial?.planning ?? false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(initial?.messages ?? []);
  const messagesRef = useRef(messages);
  const live = useRef({ provider, cwd, permission, model, effort, planning });
  live.current = { provider, cwd, permission, model, effort, planning };
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [host] = useState(() => new PluginHost());
  const responseText = useRef("");
  // Id da conversa no CLI. Vem no primeiro evento e é reenviado nas próximas mensagens.
  const sessionId = useRef<string | undefined>(initial?.sessionId);
  // null = ainda não verificado; false = precisa entrar na conta.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [loginError, setLoginError] = useState<string | undefined>(undefined);
  const [showChanges, setShowChanges] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  // Abre o terminal na primeira vez; depois ele só esconde, para não perder o shell.
  const [terminalOpened, setTerminalOpened] = useState(false);
  const [changesVersion, setChangesVersion] = useState(0);
  const [limits, setLimits] = useState<LimitState>({});
  const [context, setContext] = useState<ContextState | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        toggleTerminal();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // toggleTerminal só usa setters do React, que não mudam entre renderizações.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTerminal() {
    setTerminalOpened(true);
    setShowTerminal((on) => !on);
  }

  useEffect(() => {
    void loadInstalledPlugins(host).then(() => setNotes([...host.errors]));
    if (!cwd) {
      void getWorkspace().then(setCwd).catch((e) => setNotes([String(e)]));
    }
  }, [host]);

  useEffect(() => {
    void verifyLogin();
  }, [provider]);

  useEffect(() => {
    let active = true;
    listModels(provider)
      .then((list) => {
        if (active) setModels(list);
      })
      .catch((e) => {
        if (active) setNotes((current) => [...current, String(e)]);
      });
    return () => {
      active = false;
    };
  }, [provider]);

  useEffect(() => {
    const unlisten = onProviderEvent((event) => {
      if (event.kind === "sessionStarted") sessionId.current = event.sessionId;
      if (event.kind === "textDelta") responseText.current += event.text;
      if (event.kind === "rateLimit") {
        setLimits((current) => ({
          ...current,
          [event.window]: { utilization: event.utilization, resetsAt: event.resetsAt },
        }));
      }
      if (event.kind === "context") setContext({ tokens: event.tokens, windowSize: event.windowSize });
      commit(applyEvent(messagesRef.current, event));
      if (event.kind === "done") {
        setRunning(false);
        setChangesVersion((v) => v + 1);
        persist(messagesRef.current);
        void host.runAfterResponse(responseText.current).then(() => setNotes([...host.errors]));
      }
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [host]);

  function commit(next: ChatMessage[]) {
    messagesRef.current = next;
    setMessages(next);
  }

  function persist(current: ChatMessage[]) {
    if (current.length === 0) return;
    const firstUser = current.find((m) => m.role === "user");
    const title = firstUser ? truncate(firstUser.text, TITLE_MAX_CHARS) : "Nova conversa";
    // Lido da ref: o listener de eventos é registrado uma vez e não vê valores novos pelo closure.
    const latest = live.current;
    onPersist({
      id: conversationId,
      title,
      provider: latest.provider,
      sessionId: sessionId.current,
      cwd: latest.cwd,
      permission: latest.permission,
      model: latest.model || undefined,
      effort: latest.effort || undefined,
      planning: latest.planning,
      createdAt: createdAt.current,
      updatedAt: Date.now(),
      messages: current,
    });
  }

  async function verifyLogin() {
    setChecking(true);
    try {
      setLoggedIn(await checkAuth(provider));
      setLoginError(undefined);
    } catch (e) {
      setLoggedIn(false);
      setLoginError(String(e));
    } finally {
      setChecking(false);
    }
  }

  /// Trocar de pasta encerra a conversa atual: o id de sessão pertence à pasta anterior.
  function switchWorkspace(path: string) {
    if (path === cwd) return;
    setCwd(path);
    sessionId.current = undefined;
    commit([]);
  }

  async function browseWorkspace() {
    const picked = await pickWorkspace(cwd);
    if (picked) switchWorkspace(picked);
  }

  /// Envia um turno. `shown` aparece na conversa; `cliPrompt` é o que o CLI recebe.
  /// No modo plano, o CLI recebe a instrução de planejamento e roda só com leitura.
  async function run(shown: string, cliPrompt: string, plan: boolean) {
    setRunning(true);
    responseText.current = "";
    commit([...messagesRef.current, { role: "user", text: shown }]);
    setNotes([...host.errors]);

    try {
      await sendPrompt({
        provider,
        prompt: plan ? withPlanInstruction(cliPrompt) : cliPrompt,
        sessionId: sessionId.current,
        cwd,
        permission: plan ? "readOnly" : permission,
        model: model || undefined,
        effort: effort || undefined,
      });
    } catch (e) {
      setRunning(false);
      commit(applyEvent(messagesRef.current, { kind: "error", message: String(e) }));
      persist(messagesRef.current);
    }
  }

  async function send() {
    const prompt = draft.trim();
    if (!prompt || running || loggedIn !== true) return;
    setDraft("");

    // Comando de plugin (`/nome args`): se devolver texto, esse texto é o que vai ao provedor.
    const command = await host.handleCommand(prompt);
    if (command.handled && command.prompt === undefined) {
      setNotes([...host.errors]);
      return;
    }
    const outgoing = await host.runBeforeSend(command.handled ? command.prompt! : prompt);
    await run(prompt, outgoing, planning);
  }

  /// Aprovação do plano: sai do modo plano e manda o agente executar com a permissão escolhida.
  async function approvePlan() {
    if (running || loggedIn !== true) return;
    setPlanning(false);
    await run("Plano aprovado.", APPROVAL_PROMPT, false);
  }

  function changeModel(next: string) {
    setModel(next);
    // Nível que o novo modelo não aceita volta para o padrão.
    const supported = models.find((m) => m.id === next)?.efforts.map((e) => e.id) ?? [];
    if (!supported.includes(effort)) setEffort("");
  }

  // Sem conta conectada ou sem pasta de trabalho ainda carregada, não há como enviar.
  const blocked = loggedIn !== true || !cwd;
  const lastIsReply = messages.at(-1)?.role === "assistant";

  return (
    <div className="chat">
      <header className="chat__header">
        <h2 className="chat__title">{messages.length > 0 ? titleOf(messages) : "Nova conversa"}</h2>
        {host.commandNames().length > 0 && (
          <span className="chat__commands">
            Comandos: {host.commandNames().map((c) => `/${c}`).join(", ")}
          </span>
        )}
        <div className="chat__tools">
          <button
            type="button"
            className="chat__tool"
            aria-pressed={showChanges}
            onClick={() => setShowChanges((on) => !on)}
          >
            Alterações
          </button>
          <button
            type="button"
            className="chat__tool"
            aria-pressed={showTerminal}
            title="Terminal (Ctrl+`)"
            onClick={toggleTerminal}
          >
            Terminal
          </button>
        </div>
      </header>

      <div className="chat__split">
      <div className="chat__column">
      <div className="chat__body">
        {loggedIn === false && (
          <LoginPrompt
            provider={provider}
            onLogin={() => {
              openLogin(provider).catch((e) => setLoginError(String(e)));
            }}
            onCheck={() => void verifyLogin()}
            checking={checking}
            error={loginError}
          />
        )}

        {notes.length > 0 && (
          <ul className="chat__notes" aria-label="Avisos">
            {notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        )}

        {messages.length === 0 ? (
          <div className="chat__empty">
            <h1>Como posso ajudar?</h1>
            <p>
              {planning
                ? "Modo de planejamento: o agente pergunta antes de editar nada."
                : `Conversando com ${PROVIDER_LABELS[provider]}.`}
            </p>
          </div>
        ) : (
          <MessageList messages={messages} providerLabel={PROVIDER_LABELS[provider]} />
        )}

        {planning && lastIsReply && !running && (
          <div className="plan-approval" role="region" aria-label="Aprovação do plano">
            <p>Quando o plano estiver pronto, aprove para o agente começar a editar os arquivos.</p>
            <button type="button" onClick={() => void approvePlan()} disabled={blocked}>
              Aprovar e executar
            </button>
          </div>
        )}
      </div>

      <Composer
        draft={draft}
        onDraft={setDraft}
        onSend={() => void send()}
        onStop={() => void cancelPrompt()}
        running={running}
        blocked={blocked}
        provider={provider}
        onProvider={(next) => {
          setProvider(next);
          setModel("");
          setEffort("");
          sessionId.current = undefined;
        }}
        providerLocked={messages.length > 0}
        permission={permission}
        onPermission={setPermission}
        models={models}
        model={model}
        onModel={changeModel}
        effort={effort}
        onEffort={setEffort}
        planning={planning}
        onTogglePlanning={() => setPlanning((on) => !on)}
      />
      <div className="chat__foot">
        <WorkspaceChip
          cwd={cwd}
          recent={recentFolders}
          disabled={running}
          onPick={switchWorkspace}
          onBrowse={() => void browseWorkspace()}
        />
        {provider === "claude" && <UsageMeter limits={limits} context={context} />}
      </div>

      {terminalOpened && (
        <div hidden={!showTerminal}>
          <TerminalPanel key={cwd} cwd={cwd} />
        </div>
      )}
      </div>

      {showChanges && cwd && <ChangesPanel cwd={cwd} version={changesVersion} />}
      </div>
    </div>
  );
}

/// Título da conversa: a primeira mensagem do usuário, já truncada.
function titleOf(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  return first ? truncate(first.text, TITLE_MAX_CHARS) : "Nova conversa";
}

function truncate(text: string, max: number): string {
  const single = text.replace(/\s+/g, " ").trim();
  return single.length > max ? `${single.slice(0, max - 1)}…` : single;
}
