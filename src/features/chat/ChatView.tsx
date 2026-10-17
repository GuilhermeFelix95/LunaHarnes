import { useEffect, useState } from "react";
import { cancelPrompt, onProviderEvent, sendPrompt } from "../../api";
import { applyEvent } from "../../chat/reducer";
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

  useEffect(() => {
    const unlisten = onProviderEvent((event) => {
      setMessages((current) => applyEvent(current, event));
      if (event.kind === "done") setRunning(false);
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

  async function send() {
    const prompt = draft.trim();
    if (!prompt || running) return;

    setDraft("");
    setRunning(true);
    setMessages((current) => [...current, { role: "user", text: prompt }]);

    try {
      await sendPrompt(provider, prompt);
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
      </header>

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
