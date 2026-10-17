import { useEffect, useRef, useState } from "react";
import { cancelPrompt, onProviderEvent, sendPrompt } from "../../api";
import { applyEvent } from "../../chat/reducer";
import { PluginHost } from "../../plugins/host";
import { loadInstalledPlugins } from "../../plugins/loader";
import type { ChatMessage, ProviderKind } from "../../types";

const PROVIDER_LABELS: Record<ProviderKind, string> = {
  claude: "Claude Code",
  codex: "Codex",
};

export function ChatView() {
  const [provider, setProvider] = useState<ProviderKind>("claude");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [host] = useState(() => new PluginHost());
  const responseText = useRef("");

  useEffect(() => {
    void loadInstalledPlugins(host).then(() => setNotes([...host.errors]));
  }, [host]);

  useEffect(() => {
    const unlisten = onProviderEvent((event) => {
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

  async function send() {
    const prompt = draft.trim();
    if (!prompt || running) return;
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
      await sendPrompt(provider, outgoing);
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
            disabled={running}
            onChange={(e) => setProvider(e.target.value as ProviderKind)}
          >
            <option value="claude">{PROVIDER_LABELS.claude}</option>
            <option value="codex">{PROVIDER_LABELS.codex}</option>
          </select>
        </label>
        {host.commandNames().length > 0 && (
          <span className="chat__commands">
            Comandos: {host.commandNames().map((c) => `/${c}`).join(", ")}
          </span>
        )}
      </header>

      {notes.length > 0 && (
        <ul className="chat__notes" aria-label="Avisos de plugins">
          {notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}

      <ol className="chat__messages" aria-live="polite">
        {messages.map((m, i) => (
          <li key={i} className={`chat__message chat__message--${m.role}`}>
            <strong>{m.role === "user" ? "Você" : PROVIDER_LABELS[provider]}</strong>
            <p>{m.text}</p>
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
          rows={3}
        />
        {running ? (
          <button type="button" onClick={() => void cancelPrompt()}>
            Parar
          </button>
        ) : (
          <button type="submit" disabled={!draft.trim()}>
            Enviar
          </button>
        )}
      </form>
    </main>
  );
}
