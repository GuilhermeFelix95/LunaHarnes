import { describe, expect, it } from "vitest";
import { aggregateRate, diagnose, hitRate, type TurnRecord } from "./promptCache";

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
