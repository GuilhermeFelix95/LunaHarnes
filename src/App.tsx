import { useEffect, useState } from "react";
import {
  deleteConversation,
  listConversations,
  loadConversation,
  saveConversation,
} from "./api";
import { ChatView } from "./features/chat/ChatView";
import { Sidebar } from "./features/sidebar/Sidebar";
import type { Conversation, ConversationSummary } from "./types";

/// Conversa aberta na tela. `key` força a remontagem do chat ao trocar de conversa.
interface Session {
  key: number;
  initial?: Conversation;
}

export function App() {
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [listError, setListError] = useState<string | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [session, setSession] = useState<Session>({ key: 0 });

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

  function newConversation() {
    setActiveId(null);
    setSession((current) => ({ key: current.key + 1 }));
  }

  async function openConversation(id: string) {
    try {
      const conversation = await loadConversation(id);
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

  return (
    <div className="app">
      <Sidebar
        conversations={summaries}
        activeId={activeId}
        onNew={newConversation}
        onOpen={(id) => void openConversation(id)}
        onDelete={(id) => void removeConversation(id)}
        error={listError}
      />
      <ChatView
        key={session.key}
        initial={session.initial}
        onPersist={(conversation) => {
          setActiveId(conversation.id);
          saveConversation(conversation)
            .then(refreshList)
            .catch((e) => setListError(String(e)));
        }}
      />
    </div>
  );
}
