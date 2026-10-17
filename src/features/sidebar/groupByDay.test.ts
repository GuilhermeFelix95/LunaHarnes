import { describe, expect, it } from "vitest";
import { groupByDay } from "./groupByDay";
import type { ConversationSummary } from "../../types";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

const item = (id: string, updatedAt: number): ConversationSummary => ({
  id,
  title: id,
  provider: "claude",
  cwd: "C:\\projeto",
  updatedAt,
});

describe("groupByDay", () => {
  const now = new Date(2026, 9, 17, 15); // 17/10/2026

  it("separa em Hoje, Ontem e Anteriores, mantendo a ordem", () => {
    const groups = groupByDay(
      [
        item("hoje-1", at(2026, 10, 17, 14)),
        item("ontem", at(2026, 10, 16, 9)),
        item("hoje-2", at(2026, 10, 17, 8)),
        item("antiga", at(2026, 10, 1)),
      ],
      now,
    );

    expect(groups.map((g) => g.label)).toEqual(["Hoje", "Ontem", "Anteriores"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["hoje-1", "hoje-2"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["ontem"]);
    expect(groups[2].items.map((i) => i.id)).toEqual(["antiga"]);
  });

  it("não mostra grupos vazios", () => {
    const groups = groupByDay([item("so-hoje", at(2026, 10, 17, 10))], now);

    expect(groups.map((g) => g.label)).toEqual(["Hoje"]);
  });

  it("lista vazia não gera grupos", () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});
