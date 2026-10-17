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
      { role: "assistant", text: "Olá, tudo bem?" },
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

    expect(result[1]).toEqual({ role: "assistant", text: "", error: "codex indisponível" });
  });

  it("ferramenta vira linha própria e o texto depois dela começa uma nova resposta", () => {
    let messages: ChatMessage[] = [{ role: "user", text: "liste" }];
    messages = applyEvent(messages, { kind: "toolUse", name: "Bash", detail: "dir" });
    messages = applyEvent(messages, { kind: "textDelta", text: "Pronto." });

    expect(messages).toEqual([
      { role: "user", text: "liste" },
      { role: "assistant", text: "", tool: { name: "Bash", detail: "dir" } },
      { role: "assistant", text: "Pronto." },
    ]);
  });

  it("ignora sessionStarted e done", () => {
    const messages: ChatMessage[] = [{ role: "user", text: "oi" }];
    expect(applyEvent(messages, { kind: "sessionStarted", sessionId: "abc" })).toBe(messages);
    expect(applyEvent(messages, { kind: "done", ok: true })).toBe(messages);
  });
});
