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
import type { ChatMessage, Permission, ProviderKind } from "../../types";
import { LoginPrompt } from "../auth/LoginPrompt";

const PROVIDER_LABELS: Record<ProviderKind, string> = {
  claude: "Claude Code",
  codex: "Codex",
};

const PERMISSION_LABELS: Record<Permission, string> = {
  readOnly: "Só leitura",
  acceptEdits: "Aceitar edições",
  fullAccess: "Acesso total",
};

export function ChatView() {
  const [provider, setProvider] = useState<ProviderKind>("claude");
  const [permission, setPermission] = useState<Permission>("acceptEdits");
  const [cwd, setCwd] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [host] = useState(() => new PluginHost());
  const responseText = useRef("");
  // Id da conversa no CLI. Vem no primeiro evento e é reenviado nas próximas mensagens.
  const sessionId = useRef<string | undefined>(undefined);
  // null = ainda não verificado; false = precisa entrar na conta.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [loginError, setLoginError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void loadInstalledPlugins(host).then(() => setNotes([...host.errors]));
    void getWorkspace().then(setCwd).catch((e) => setNotes([String(e)]));
  }, [host]);

  useEffect(() => {
    void verifyLogin();
  }, [provider]);

  useEffect(() => {
    const unlisten = onProviderEvent((event) => {
      if (event.kind === "sessionStarted") sessionId.current = event.sessionId;
      setMessages((current) => applyEvent(current, event));
      if (event.kind === "textDelta") responseText.current += event.text;
      if (event.kind === "done") {
        setRunning(false);
        void host.runAfterResponse(responseText.current).then(() => setNotes([...host.errors]));
      }
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [host]);

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
    setMessages([]);
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
    setMessages((current) => [...current, { role: "user", text: prompt }]);
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
      setMessages((current) =>
        applyEvent(current, { kind: "error", message: String(e) }),
      );
    }
  }

  return (
    <main className="chat">
      <header className="chat__header">
        <label>
          Provedor{" "}
          <select
            value={provider}
            disabled={running || messages.length > 0}
            onChange={(e) => setProvider(e.target.value as ProviderKind)}
          >
            <option value="claude">{PROVIDER_LABELS.claude}</option>
            <option value="codex">{PROVIDER_LABELS.codex}</option>
          </select>
        </label>
        <label>
          Permissão{" "}
          <select
            value={permission}
            disabled={running}
            onChange={(e) => setPermission(e.target.value as Permission)}
          >
            {(Object.keys(PERMISSION_LABELS) as Permission[]).map((p) => (
              <option key={p} value={p}>
                {PERMISSION_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <span className="chat__workspace" title={cwd}>
          {cwd}{" "}
          <button type="button" onClick={() => void changeWorkspace()} disabled={running}>
            Trocar
          </button>
        </span>
        {host.commandNames().length > 0 && (
          <span className="chat__commands">
            Comandos: {host.commandNames().map((c) => `/${c}`).join(", ")}
          </span>
        )}
      </header>

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

      <ol className="chat__messages" aria-live="polite">
        {messages.map((m, i) => (
          <li key={i} className={`chat__message chat__message--${m.role}`}>
            <strong>{m.role === "user" ? "Você" : PROVIDER_LABELS[provider]}</strong>
            {m.tool ? (
              <p className="chat__tool">
                {m.tool.name} · {m.tool.detail}
              </p>
            ) : (
              <p>{m.text}</p>
            )}
            {m.error && <p role="alert" className="chat__error">{m.error}</p>}
          </li>
        ))}
      </ol>

      <form
        className="chat__input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          aria-label="Mensagem"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={loggedIn !== true}
          rows={3}
        />
        {running ? (
          <button type="button" onClick={() => void cancelPrompt()}>
            Parar
          </button>
        ) : (
          <button type="submit" disabled={!draft.trim() || loggedIn !== true}>
            Enviar
          </button>
        )}
      </form>
    </main>
  );
}
