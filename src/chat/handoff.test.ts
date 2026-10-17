import { describe, expect, it } from "vitest";
import type { ChatMessage, Changes } from "../types";
import { contextFor, renderHistory } from "./handoff";

const history: ChatMessage[] = [
  { role: "user", text: "crie a landing page" },
  { role: "assistant", text: "", tool: { name: "Write", detail: "index.html" }, provider: "claude" },
  { role: "assistant", text: "Criei index.html e styles.css.", provider: "claude" },
];

const changes: Changes = {
  isRepo: true,
  files: [{ path: "index.html", status: "untracked", additions: 40, deletions: 0 }],
};

describe("renderHistory", () => {
  it("mostra autor de cada mensagem e ferramentas em uma linha", () => {
    const text = renderHistory(history, "claude");

    expect(text).toContain("### Você\ncrie a landing page");
    expect(text).toContain("- Ferramenta (Claude Code): Write · index.html");
    expect(text).toContain("### Claude Code\nCriei index.html e styles.css.");
  });

  it("acima do limite corta respostas antigas do agente e mantém as do usuário e as recentes", () => {
    const long = "x".repeat(5000);
    const messages: ChatMessage[] = [
      { role: "user", text: "pedido antigo " + "u".repeat(3000) },
      { role: "assistant", text: long, provider: "claude" },
      { role: "user", text: "pedido 2" },
      { role: "assistant", text: "a2", provider: "claude" },
      { role: "user", text: "pedido 3" },
      { role: "assistant", text: "a3", provider: "claude" },
      { role: "user", text: "pedido 4" },
      { role: "assistant", text: "fim " + long, provider: "claude" },
    ];

    const text = renderHistory(messages, "claude", 9000);

    expect(text).toContain("u".repeat(3000));
    expect(text).toContain("[resposta resumida pelo app]");
    expect(text).toContain("fim " + long);
  });
});

describe("contextFor", () => {
  it("conversa nova não manda contexto", () => {
    expect(contextFor({ sessions: {}, target: "codex", history: [], fallback: "claude", cwd: "C:\\p", changes })).toEqual({
      sessionId: undefined,
      preamble: undefined,
    });
  });

  it("agente sem sessão recebe o histórico inteiro e o estado do git", () => {
    const result = contextFor({ sessions: { claude: { id: "s-c", seen: 3 } }, target: "codex", history, fallback: "claude", cwd: "C:\\p", changes });

    expect(result.sessionId).toBeUndefined();
    expect(result.preamble).toContain("Claude Code");
    expect(result.preamble).toContain("crie a landing page");
    expect(result.preamble).toContain("C:\\p");
    expect(result.preamble).toContain("index.html (novo, +40 −0)");
    expect(result.preamble).toContain("Releia os arquivos");
  });

  it("agente que volta retoma a sessão e recebe só o que não viu", () => {
    const more: ChatMessage[] = [
      ...history,
      { role: "user", text: "agora com o codex" },
      { role: "assistant", text: "Ajustei o CSS.", provider: "codex" },
    ];

    const result = contextFor({ sessions: { claude: { id: "s-c", seen: 3 }, codex: { id: "s-x", seen: 5 } }, target: "claude", history: more, fallback: "claude", cwd: "C:\\p", changes });

    expect(result.sessionId).toBe("s-c");
    expect(result.preamble).toContain("agora com o codex");
    expect(result.preamble).toContain("### Codex\nAjustei o CSS.");
    expect(result.preamble).not.toContain("crie a landing page");
  });

  it("mesmo agente sem nada novo só retoma, sem preâmbulo", () => {
    const result = contextFor({ sessions: { claude: { id: "s-c", seen: 3 } }, target: "claude", history, fallback: "claude", cwd: "C:\\p", changes });

    expect(result).toEqual({ sessionId: "s-c", preamble: undefined });
  });

  it("sem repositório git, avisa em vez de listar arquivos", () => {
    const result = contextFor({ sessions: {}, target: "codex", history, fallback: "claude", cwd: "C:\\p", changes: { isRepo: false, files: [] } });

    expect(result.preamble).toContain("não é um repositório git");
  });
});
