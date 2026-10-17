import { useEffect, useRef, useState } from "react";
import {
  cancelPrompt,
  checkAuth,
  getWorkspace,
  onProviderEvent,
  openLogin,
  pickWorkspace,
  sendPrompt,
} from "../../api";
import { applyEvent } from "../../chat/reducer";
import { PluginHost } from "../../plugins/host";
import { loadInstalledPlugins } from "../../plugins/loader";
import type { ChatMessage, Conversation, Permission, ProviderKind } from "../../types";
import { LoginPrompt } from "../auth/LoginPrompt";
import { Composer, PROVIDER_LABELS } from "./Composer";
import { MessageList } from "./MessageList";

const TITLE_MAX_CHARS = 60;

interface ChatViewProps {
  /** Conversa aberta do histórico. Ausente = conversa nova. */
  initial?: Conversation;
  /** Chamado ao fim de cada turno, com a conversa inteira, para salvar em disco. */
  onPersist: (conversation: Conversation) => void;
}

export function ChatView({ initial, onPersist }: ChatViewProps) {
  const [conversationId] = useState(() => initial?.id ?? crypto.randomUUID());
  const createdAt = useRef(initial?.createdAt ?? Date.now());

  const [provider, setProvider] = useState<ProviderKind>(initial?.provider ?? "claude");
  const [permission, setPermission] = useState<Permission>(initial?.permission ?? "acceptEdits");
  const [cwd, setCwd] = useState(initial?.cwd ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>(initial?.messages ?? []);
  const messagesRef = useRef(messages);
  const live = useRef({ provider, cwd, permission });
  live.current = { provider, cwd, permission };
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
    const unlisten = onProviderEvent((event) => {
      if (event.kind === "sessionStarted") sessionId.current = event.sessionId;
      if (event.kind === "textDelta") responseText.current += event.text;
      commit(applyEvent(messagesRef.current, event));
      if (event.kind === "done") {
        setRunning(false);
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
    const { provider: currentProvider, cwd: currentCwd, permission: currentPermission } = live.current;
    onPersist({
      id: conversationId,
      title,
      provider: currentProvider,
      sessionId: sessionId.current,
      cwd: currentCwd,
      permission: currentPermission,
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
  async function changeWorkspace() {
    const picked = await pickWorkspace(cwd);
    if (!picked || picked === cwd) return;
    setCwd(picked);
    sessionId.current = undefined;
    commit([]);
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

    setRunning(true);
    responseText.current = "";
    commit([...messagesRef.current, { role: "user", text: prompt }]);
    setNotes([...host.errors]);

    try {
      await sendPrompt({
        provider,
        prompt: outgoing,
        sessionId: sessionId.current,
        cwd,
        permission,
      });
    } catch (e) {
      setRunning(false);
      commit(applyEvent(messagesRef.current, { kind: "error", message: String(e) }));
      persist(messagesRef.current);
    }
  }

  // Sem conta conectada ou sem pasta de trabalho ainda carregada, não há como enviar.
  const blocked = loggedIn !== true || !cwd;

  return (
    <div className="chat">
      <header className="chat__header">
        <span className="chat__workspace" title={cwd}>
          {cwd}
        </span>
        <button type="button" className="chat__link" onClick={() => void changeWorkspace()} disabled={running}>
          Trocar pasta
        </button>
        {host.commandNames().length > 0 && (
          <span className="chat__commands">
            Comandos: {host.commandNames().map((c) => `/${c}`).join(", ")}
          </span>
        )}
      </header>

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
          </div>
        ) : (
          <MessageList messages={messages} providerLabel={PROVIDER_LABELS[provider]} />
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
          sessionId.current = undefined;
        }}
        providerLocked={messages.length > 0}
        permission={permission}
        onPermission={setPermission}
      />
    </div>
  );
}

function truncate(text: string, max: number): string {
  const single = text.replace(/\s+/g, " ").trim();
  return single.length > max ? `${single.slice(0, max - 1)}…` : single;
}
