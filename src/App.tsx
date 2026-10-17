import { useEffect, useState } from "react";
import {
  deleteConversation,
  listConversations,
  loadConversation,
  pickWorkspace,
  saveConversation,
} from "./api";
import { ChatView } from "./features/chat/ChatView";
import { SettingsView } from "./features/settings/SettingsView";
import { Sidebar } from "./features/sidebar/Sidebar";
import type { Conversation, ConversationSummary } from "./types";

/// Conversa aberta na tela. `key` força a remontagem do chat ao trocar de conversa.
interface Session {
  key: number;
  initial?: Conversation;
  /** Pasta de uma conversa nova. Ausente = pasta de onde o luna foi rodado. */
  startCwd?: string;
}

export function App() {
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [listError, setListError] = useState<string | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [session, setSession] = useState<Session>({ key: 0 });
  // O chat fica montado enquanto as configurações estão abertas, para não cortar uma resposta.
  const [view, setView] = useState<"chat" | "settings">("chat");

  useEffect(() => {
    void refreshList();
  }, []);

  async function refreshList() {
    try {
      setSummaries(await listConversations());
      setListError(undefined);
    } catch (e) {
      setListError(String(e));
    }
  }

  function newConversation(cwd?: string) {
    setView("chat");
    setActiveId(null);
    setSession((current) => ({ key: current.key + 1, startCwd: cwd }));
  }

  /// Escolhe uma pasta e começa uma conversa nela. Cancelar o seletor não faz nada.
  async function addProject() {
    try {
      const picked = await pickWorkspace();
      if (picked) newConversation(picked);
    } catch (e) {
      setListError(String(e));
    }
  }

  async function openConversation(id: string) {
    try {
      const conversation = await loadConversation(id);
      setView("chat");
      setActiveId(id);
      setSession((current) => ({ key: current.key + 1, initial: conversation }));
    } catch (e) {
      setListError(String(e));
    }
  }

  async function removeConversation(id: string) {
    const title = summaries.find((s) => s.id === id)?.title ?? "esta conversa";
    if (!window.confirm(`Excluir "${title}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await deleteConversation(id);
      if (activeId === id) newConversation();
      await refreshList();
    } catch (e) {
      setListError(String(e));
    }
  }

  // Pastas de conversas anteriores, sem repetir: alimentam o menu de troca no rodapé do chat.
  const recentFolders = [...new Set(summaries.map((s) => s.cwd))];

  return (
    <div className="app">
      <Sidebar
        conversations={summaries}
        activeId={activeId}
        onNew={(cwd) => newConversation(cwd)}
        onAddProject={() => void addProject()}
        onOpen={(id) => void openConversation(id)}
        onDelete={(id) => void removeConversation(id)}
        onSettings={() => setView((v) => (v === "settings" ? "chat" : "settings"))}
        settingsOpen={view === "settings"}
        error={listError}
      />
      <main className="app__main">
      {view === "settings" && <SettingsView onClose={() => setView("chat")} />}
      <div className="app__view" hidden={view !== "chat"}>
      <ChatView
        key={session.key}
        initial={session.initial}
        startCwd={session.startCwd}
        recentFolders={recentFolders}
        onPersist={(conversation) => {
          setActiveId(conversation.id);
          saveConversation(conversation)
            .then(refreshList)
            .catch((e) => setListError(String(e)));
        }}
      />
      </div>
      </main>
    </div>
  );
}
