import { describe, expect, it } from "vitest";
import { aggregateRate, diagnose, hitRate, summarize, type TurnRecord } from "./promptCache";

const turn = (over: Partial<TurnRecord> = {}): TurnRecord => ({
  usage: { fresh: 100, read: 900, write: 0 },
  at: 1_000_000,
  model: "claude-opus-5-5",
  systemKey: "sys-a",
  sessionId: "s1",
  ...over,
});

describe("taxa de acerto", () => {
  it("é o que veio do cache sobre a entrada total do turno", () => {
    expect(hitRate({ fresh: 100, read: 900, write: 0 })).toBeCloseTo(0.9);
  });

  it("sem o campo de leitura não há taxa, e zero não vira 0%", () => {
    expect(hitRate({ fresh: 100, read: null, write: null })).toBeNull();
  });

  it("turno sem entrada não tem taxa", () => {
    expect(hitRate({ fresh: 0, read: 0, write: 0 })).toBeNull();
  });

  it("a taxa da sessão pesa pelos tokens, e ignora turnos sem leitura", () => {
    const rate = aggregateRate([
      { fresh: 100, read: 900, write: 0 },
      { fresh: 0, read: 0, write: 1000 },
      { fresh: 50, read: null, write: null },
    ]);
    expect(rate).toBeCloseTo(900 / 2000);
  });
});

describe("diagnóstico de acerto baixo", () => {
  it("acerto bom não tem diagnóstico", () => {
    expect(diagnose(turn(), turn({ at: 1_000_060 }), false)).toBeNull();
  });

  it("o primeiro turno com acerto baixo aparece como aquecendo", () => {
    expect(diagnose(null, turn({ usage: { fresh: 900, read: 0, write: 0 } }), false)).toBe("aquecendo");
  });

  it("sessão nova, modelo trocado e prompt de sistema mudado têm prioridade sobre pausa", () => {
    const low = { fresh: 900, read: 10, write: 0 };
    expect(diagnose(turn(), turn({ usage: low, sessionId: "s2", at: 9_999_999 }), false)).toBe("sessao-nova");
    expect(diagnose(turn(), turn({ usage: low, model: "outro", at: 9_999_999 }), false)).toBe("modelo-trocado");
    expect(diagnose(turn(), turn({ usage: low, systemKey: "sys-b", at: 9_999_999 }), false)).toBe("prompt-mudou");
  });

  it("pausa maior que o TTL de 5 min explica o acerto baixo, e 1 h com o cache longo", () => {
    const low = { fresh: 900, read: 10, write: 0 };
    const later = turn({ usage: low, at: 1_000_000 + 6 * 60_000 });
    expect(diagnose(turn(), later, false)).toBe("pausa");
    expect(diagnose(turn(), later, true)).toBe("desconhecido");
  });
});

describe("resumo do cache da conversa", () => {
  const at = (minutes: number) => 1_000_000 + minutes * 60_000;
  const warm = { fresh: 100, read: 900, write: 0 };
  const cold = { fresh: 900, read: 10, write: 0 };

  it("traz a taxa da sessão, o total lido e o histórico dos últimos 12 turnos", () => {
    const turns = Array.from({ length: 14 }, (_, i) => turn({ usage: warm, at: at(i), sessionId: "s1" }));
    const s = summarize(turns, { provider: "claude", longTtl: false, now: at(14) });
    expect(s.session).toBeCloseTo(0.9);
    expect(s.readTotal).toBe(900 * 14);
    expect(s.freshTotal).toBe(100 * 14);
    expect(s.writeTotal).toBe(0);
    expect(s.history).toHaveLength(12);
    expect(s.last?.rate).toBeCloseTo(0.9);
  });

  it("Claude: quente pelo tempo que falta para o TTL, e frio depois dele", () => {
    const turns = [turn({ usage: warm, at: at(0) })];
    expect(summarize(turns, { provider: "claude", longTtl: false, now: at(2) }).warm).toEqual({
      state: "quente",
      remainingMs: 3 * 60_000,
    });
    expect(summarize(turns, { provider: "claude", longTtl: false, now: at(6) }).warm).toEqual({ state: "frio" });
  });

  it("Codex não informa o TTL do cache, e sem leitura o estado é sem dados", () => {
    expect(summarize([turn({ usage: warm })], { provider: "codex", longTtl: false, now: at(1) }).warm).toEqual({ state: "sem-ttl" });
    expect(summarize([turn({ usage: { fresh: 5, read: null, write: null } })], { provider: "claude", longTtl: false, now: at(1) }).warm).toEqual({ state: "sem-dados" });
  });

  it("sugere o cache de 1 h quando pausas apagam o cache, e só sem ele ligado", () => {
    const turns = [
      turn({ usage: warm, at: at(0) }),
      turn({ usage: cold, at: at(10) }),
      turn({ usage: cold, at: at(20) }),
    ];
    expect(summarize(turns, { provider: "claude", longTtl: false, now: at(21) }).tip).toMatch(/1 h/);
    expect(summarize(turns, { provider: "claude", longTtl: true, now: at(21) }).tip).toBeNull();
  });
});
