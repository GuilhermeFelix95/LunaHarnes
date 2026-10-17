import { useEffect, useRef, useState } from "react";
import {
  cancelPrompt,
  checkAuth,
  getChanges,
  getWorkspace,
  listModels,
  onProviderEvent,
  openLogin,
  pickWorkspace,
  sendPrompt,
} from "../../api";
import { contextFor, withContext } from "../../chat/handoff";
import { APPROVAL_PROMPT, withPlanInstruction } from "../../chat/planning";
import { applyEvent } from "../../chat/reducer";
import { useStickToBottom } from "../../chat/useStickToBottom";
import { PluginHost } from "../../plugins/host";
import { loadInstalledPlugins } from "../../plugins/loader";
import type { AgentSessions, ChatMessage, Conversation, ModelOption, Permission, ProviderKind } from "../../types";
import { ChangesPanel } from "../changes/ChangesPanel";
import { LoginPrompt } from "../auth/LoginPrompt";
import { RightPanel, type SideTab } from "../side/RightPanel";
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
  const live = useRef({ provider, cwd, permission, model, effort, planning, sideTab: "changes" as SideTab });
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [host] = useState(() => new PluginHost());
  const responseText = useRef("");
  // Sessão nativa de cada agente e quanto do histórico ele já viu (ver chat/handoff.ts).
  const sessions = useRef<AgentSessions>(initialSessions(initial));
  // Agente do turno em andamento: os eventos da CLI não dizem de quem são.
  const turnProvider = useRef<ProviderKind>(provider);
  // Autor das respostas salvas antes de cada mensagem guardar o agente.
  const legacyProvider = useRef<ProviderKind>(initial?.provider ?? provider);
  // null = ainda não verificado; false = precisa entrar na conta.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [loginError, setLoginError] = useState<string | undefined>(undefined);
  // Painel da direita: aberto ou não, e qual aba.
  const [sideOpen, setSideOpen] = useState(true);
  const [sideTab, setSideTab] = useState<SideTab>("changes");
  // Abre o terminal na primeira vez; depois ele só esconde, para não perder o shell.
  const [terminalOpened, setTerminalOpened] = useState(false);
  const [changesVersion, setChangesVersion] = useState(0);
  live.current = { provider, cwd, permission, model, effort, planning, sideTab };
  const [limits, setLimits] = useState<LimitState>({});
  const [context, setContext] = useState<ContextState | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const { stuck, scrollToBottom } = useStickToBottom(body, messages);

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

  /// Abre o painel na aba pedida; se ela já está à mostra, fecha o painel.
  function toggleSide(tab: SideTab) {
    if (tab === "terminal") setTerminalOpened(true);
    setSideOpen((open) => !(open && live.current.sideTab === tab));
    setSideTab(tab);
  }

  function toggleTerminal() {
    toggleSide("terminal");
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
        if (!active) return;
        setModels(list);
        // Sem escolha válida, usa o primeiro modelo da lista.
        const chosen = list.find((m) => m.id === live.current.model) ?? list[0];
        const supported = chosen?.efforts.map((e) => e.id) ?? [];
        setModel(chosen?.id ?? "");
        if (!supported.includes(live.current.effort)) setEffort("");
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
      const turn = turnProvider.current;
      if (event.kind === "sessionStarted") {
        sessions.current = {
          ...sessions.current,
          [turn]: { id: event.sessionId, seen: sessions.current[turn]?.seen ?? 0 },
        };
      }
      if (event.kind === "textDelta") responseText.current += event.text;
      if (event.kind === "rateLimit") {
        setLimits((current) => ({
          ...current,
          [event.window]: { utilization: event.utilization, resetsAt: event.resetsAt },
        }));
      }
      if (event.kind === "context") setContext({ tokens: event.tokens, windowSize: event.windowSize });
      commit(applyEvent(messagesRef.current, event, turn));
      if (event.kind === "done") {
        const session = sessions.current[turn];
        // O agente viu tudo até o fim deste turno.
        if (session) sessions.current = { ...sessions.current, [turn]: { ...session, seen: messagesRef.current.length } };
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
      sessionId: sessions.current[latest.provider]?.id,
      sessions: sessions.current,
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
    sessions.current = {};
    commit([]);
  }

  async function browseWorkspace() {
    const picked = await pickWorkspace(cwd);
    if (picked) switchWorkspace(picked);
  }

  /// Envia um turno. `shown` aparece na conversa; `cliPrompt` é o que o CLI recebe.
  /// No modo plano, o CLI recebe a instrução de planejamento e roda só com leitura.
  /// Se o agente ainda não viu parte do histórico (troca de agente), o contexto vai antes da mensagem.
  async function run(shown: string, cliPrompt: string, plan: boolean) {
    setRunning(true);
    responseText.current = "";
    turnProvider.current = provider;
    const history = messagesRef.current;
    commit([...history, { role: "user", text: shown }]);
    // Quem envia quer ver a resposta: volta a seguir o fim.
    scrollToBottom();
    setNotes([...host.errors]);

    try {
      const behind = (sessions.current[provider]?.seen ?? 0) < history.length;
      const changes = behind ? await getChanges(cwd).catch(() => null) : null;
      const { sessionId, preamble } = contextFor({
        sessions: sessions.current,
        target: provider,
        history,
        fallback: legacyProvider.current,
        cwd,
        changes,
      });
      await sendPrompt({
        provider,
        prompt: withContext(preamble, plan ? withPlanInstruction(cliPrompt) : cliPrompt),
        sessionId,
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
            aria-pressed={sideOpen && sideTab === "changes"}
            onClick={() => toggleSide("changes")}
          >
            Alterações
          </button>
          <button
            type="button"
            className="chat__tool"
            aria-pressed={sideOpen && sideTab === "terminal"}
            title="Terminal (Ctrl+`)"
            onClick={toggleTerminal}
          >
            Terminal
          </button>
        </div>
      </header>

      <div className="chat__split">
      <div className="chat__column">
      <div className="chat__body" ref={body}>
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
          <MessageList messages={messages} fallbackProvider={legacyProvider.current} running={running} />
        )}

        {!stuck && messages.length > 0 && (
          <button type="button" className="chat__to-end" onClick={scrollToBottom}>
            Ir para o fim ↓
          </button>
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
          // A conversa continua: o novo agente recebe o histórico no próximo envio.
          setModel("");
          setEffort("");
        }}
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
      </div>

      <RightPanel
        open={sideOpen}
        tab={sideTab}
        onTab={(tab) => {
          if (tab === "terminal") setTerminalOpened(true);
          setSideTab(tab);
        }}
        changes={cwd ? <ChangesPanel cwd={cwd} version={changesVersion} /> : null}
        terminal={terminalOpened && cwd ? <TerminalPanel key={cwd} cwd={cwd} /> : null}
      />
      </div>
    </div>
  );
}

/// Sessões de uma conversa salva. Arquivos antigos só têm `sessionId`, que o agente viu até o fim.
function initialSessions(initial?: Conversation): AgentSessions {
  if (initial?.sessions) return initial.sessions;
  if (initial?.sessionId) return { [initial.provider]: { id: initial.sessionId, seen: initial.messages.length } };
  return {};
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
