import { describe, expect, it } from "vitest";
import { parseDiffLines } from "./diffLines";

describe("parseDiffLines", () => {
  it("numera a linha antiga e a nova a partir do @@ e pula os cabeçalhos do git", () => {
    const diff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "index 1111..2222 100644",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -10,3 +10,4 @@",
      " um",
      "-velho",
      "+novo",
      "+extra",
      " dois",
      "",
    ].join("\n");

    expect(parseDiffLines(diff)).toEqual([
      { kind: "hunk", oldNo: null, newNo: null, text: "@@ -10,3 +10,4 @@" },
      { kind: "ctx", oldNo: 10, newNo: 10, text: " um" },
      { kind: "del", oldNo: 11, newNo: null, text: "-velho" },
      { kind: "add", oldNo: null, newNo: 11, text: "+novo" },
      { kind: "add", oldNo: null, newNo: 12, text: "+extra" },
      { kind: "ctx", oldNo: 12, newNo: 13, text: " dois" },
    ]);
  });

  it("cada trecho (@@) recomeça a contagem no número dele", () => {
    const diff = ["@@ -1 +1 @@", "-a", "+b", "@@ -50,2 +60,2 @@", " c", "-d", "+e"].join("\n");

    const lines = parseDiffLines(diff);

    expect(lines.find((l) => l.text === " c")).toMatchObject({ oldNo: 50, newNo: 60 });
    expect(lines.find((l) => l.text === "+e")).toMatchObject({ kind: "add", newNo: 61 });
  });

  it("ignora a linha \"\\ No newline at end of file\"", () => {
    const diff = ["@@ -1 +1 @@", "-a", "\\ No newline at end of file", "+a"].join("\n");

    expect(parseDiffLines(diff).map((l) => l.text)).toEqual(["@@ -1 +1 @@", "-a", "+a"]);
  });

  it("arquivo novo sem @@ (conteúdo como linhas +) conta a partir da linha 1", () => {
    const lines = parseDiffLines("+primeira\n+segunda\n");

    expect(lines).toEqual([
      { kind: "add", oldNo: null, newNo: 1, text: "+primeira" },
      { kind: "add", oldNo: null, newNo: 2, text: "+segunda" },
    ]);
  });

  it("diff vazio não tem linhas", () => {
    expect(parseDiffLines("")).toEqual([]);
  });
});
