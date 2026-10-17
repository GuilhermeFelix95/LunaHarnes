import { describe, expect, it } from "vitest";
import type { ConversationSummary } from "../../types";
import { folderName, groupByProject } from "./groupByProject";

const now = new Date(2026, 9, 17, 12, 0, 0);
const at = (hours: number) => new Date(2026, 9, 17, hours).getTime();

function conv(id: string, cwd: string, updatedAt: number): ConversationSummary {
  return { id, title: id, provider: "claude", cwd, updatedAt };
}

describe("groupByProject", () => {
  it("separa as conversas por pasta e põe o projeto mais recente primeiro", () => {
    const groups = groupByProject(
      [
        conv("a", "C:\\LunaHarnes", at(9)),
        conv("b", "C:\\Downloads", at(11)),
        conv("c", "C:\\LunaHarnes", at(10)),
      ],
      now,
    );

    expect(groups.map((g) => g.name)).toEqual(["Downloads", "LunaHarnes"]);
    expect(groups[1].days[0].items.map((c) => c.id)).toEqual(["c", "a"]);
  });

  it("não cria projeto para lista vazia", () => {
    expect(groupByProject([], now)).toEqual([]);
  });
});

describe("folderName", () => {
  it("usa o último segmento do caminho, com \\ ou /", () => {
    expect(folderName("C:\\Users\\guilh\\Documents\\LunaHarnes")).toBe("LunaHarnes");
    expect(folderName("/home/guilh/app/")).toBe("app");
  });

  it("raiz de unidade mostra a própria unidade", () => {
    expect(folderName("C:\\")).toBe("C:");
  });
});
