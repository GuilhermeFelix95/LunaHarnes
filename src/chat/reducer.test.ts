import { describe, expect, it } from "vitest";
import { applyEvent } from "./reducer";
import type { ChatMessage } from "../types";

describe("applyEvent", () => {
  it("concatena deltas de texto na mesma mensagem do assistente", () => {
    const start: ChatMessage[] = [{ role: "user", text: "oi" }];
    const afterFirst = applyEvent(start, { kind: "textDelta", text: "Olá" });
    const afterSecond = applyEvent(afterFirst, { kind: "textDelta", text: ", tudo bem?" });

    expect(afterSecond).toEqual([
      { role: "user", text: "oi" },
      { role: "assistant", text: "Olá, tudo bem?", at: expect.any(Number) },
    ]);
  });

  it("anexa erro à última resposta do assistente", () => {
    const messages: ChatMessage[] = [
      { role: "user", text: "oi" },
      { role: "assistant", text: "parcial" },
    ];
    const result = applyEvent(messages, { kind: "error", message: "limite excedido" });

    expect(result[1]).toEqual({ role: "assistant", text: "parcial", error: "limite excedido" });
  });

  it("cria mensagem de erro quando não há resposta ainda", () => {
    const result = applyEvent([{ role: "user", text: "oi" }], {
      kind: "error",
      message: "codex indisponível",
    });

    expect(result[1]).toEqual({ role: "assistant", text: "", error: "codex indisponível", at: expect.any(Number) });
  });

  it("ferramenta vira linha própria e o texto depois dela começa uma nova resposta", () => {
    let messages: ChatMessage[] = [{ role: "user", text: "liste" }];
    messages = applyEvent(messages, { kind: "toolUse", id: "", name: "Bash", detail: "dir" });
    messages = applyEvent(messages, { kind: "textDelta", text: "Pronto." });

    expect(messages).toEqual([
      { role: "user", text: "liste" },
      { role: "assistant", text: "", tool: { id: "", name: "Bash", detail: "dir" }, at: expect.any(Number) },
      { role: "assistant", text: "Pronto.", at: expect.any(Number) },
    ]);
  });

  it("ignora sessionStarted e done", () => {
    const messages: ChatMessage[] = [{ role: "user", text: "oi" }];
    expect(applyEvent(messages, { kind: "sessionStarted", sessionId: "abc" })).toBe(messages);
    expect(applyEvent(messages, { kind: "done", ok: true })).toBe(messages);
  });
});

describe("applyEvent com agente de perfil", () => {
  it("marca a resposta com o provedor e o nome do perfil", () => {
    const result = applyEvent([{ role: "user", text: "oi" }], { kind: "textDelta", text: "Olá" }, "claude", "DeepSeek · via Claude Code");

    expect(result[1]).toEqual({ role: "assistant", text: "Olá", provider: "claude", agent: "DeepSeek · via Claude Code", at: expect.any(Number) });
  });
});

describe("applyEvent: resultado de ferramenta", () => {
  it("marca a ação certa como concluída ou falha, pelo id", () => {
    let messages: ChatMessage[] = [];
    messages = applyEvent(messages, { kind: "toolUse", id: "t1", name: "Bash", detail: "npm test" });
    messages = applyEvent(messages, { kind: "toolUse", id: "t2", name: "Read", detail: "a.ts" });
    messages = applyEvent(messages, { kind: "toolResult", id: "t1", ok: false, output: "" });
    messages = applyEvent(messages, { kind: "toolResult", id: "t2", ok: true, output: "" });

    expect(messages.map((m) => m.tool?.ok)).toEqual([false, true]);
  });

  it("resultado sem ação correspondente não muda a conversa", () => {
    const before: ChatMessage[] = [{ role: "user", text: "oi" }];

    expect(applyEvent(before, { kind: "toolResult", id: "x", ok: true, output: "" })).toBe(before);
  });
});
