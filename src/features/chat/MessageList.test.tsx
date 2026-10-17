import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../../types";
import { MessageList } from "./MessageList";

const tool = (name: string, detail: string): ChatMessage => ({
  role: "assistant",
  text: "",
  tool: { name, detail },
  provider: "claude",
});

const turn: ChatMessage[] = [
  { role: "user", text: "cria um jogo da cobrinha" },
  tool("Bash", "ls -la"),
  tool("Write", "index.html"),
  tool("Write", "style.css"),
  { role: "assistant", text: "Pronto, criei o jogo.", provider: "claude" },
];

describe("MessageList", () => {
  it("mostra o nome do agente uma vez por resposta", () => {
    render(<MessageList messages={turn} fallbackProvider="claude" running={false} />);

    expect(screen.getAllByText("Claude Code")).toHaveLength(1);
    expect(screen.getByText("Pronto, criei o jogo.")).toBeTruthy();
  });

  it("mostra o avatar do agente em cada resposta", () => {
    render(<MessageList messages={turn} fallbackProvider="claude" running={false} />);

    const avatars = document.querySelectorAll(".message__avatar");
    expect(avatars).toHaveLength(1);
    expect(avatars[0].querySelector("svg")).toBeTruthy();
  });

  it("junta ferramentas seguidas numa linha recolhível com a contagem", () => {
    render(<MessageList messages={turn} fallbackProvider="claude" running={false} />);

    expect(screen.getByText("3 ações · Bash, Write ×2")).toBeTruthy();
    // Os comandos continuam disponíveis ao expandir.
    expect(screen.getByText("index.html")).toBeTruthy();
  });

  it("uma ação só mostra o comando direto", () => {
    render(<MessageList messages={turn.slice(0, 2)} fallbackProvider="claude" running={false} />);

    expect(screen.getByText("Bash · ls -la")).toBeTruthy();
  });

  it("enquanto o agente trabalha sem texto, mostra Trabalhando…", () => {
    render(<MessageList messages={turn.slice(0, 3)} fallbackProvider="claude" running />);

    expect(screen.getByText(/Trabalhando…/)).toBeTruthy();
  });

  it("respostas de agentes diferentes mostram cada nome", () => {
    const messages: ChatMessage[] = [
      ...turn,
      { role: "user", text: "agora no codex" },
      { role: "assistant", text: "Feito.", provider: "codex" },
    ];
    render(<MessageList messages={messages} fallbackProvider="claude" running={false} />);

    expect(screen.getByText("Claude Code")).toBeTruthy();
    expect(screen.getByText("Codex")).toBeTruthy();
  });
});

describe("MessageList com perfil de API", () => {
  it("mostra o nome do perfil no lugar do nome do CLI", () => {
    render(
      <MessageList
        messages={[{ role: "assistant", text: "oi", provider: "claude", agent: "DeepSeek · via Claude Code" }]}
        fallbackProvider="claude"
        running={false}
      />,
    );

    expect(screen.getByText("DeepSeek · via Claude Code")).toBeTruthy();
    expect(screen.queryByText("Claude Code")).toBeNull();
  });
});
