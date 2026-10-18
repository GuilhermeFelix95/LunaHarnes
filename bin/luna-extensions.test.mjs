import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import * as realFs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkSkill, extensionFrom, installMcp, installSkill, invalidValues, mcpCommands, missingEnv, sha256 } from "./luna-extensions.mjs";

const content = "---\nname: x\ndescription: y\n---\nfaça algo";
const skill = { id: "x", name: "X", files: [{ path: "SKILL.md", sha256: sha256(content), content }] };

describe("luna skills/mcp: entrada", () => {
  it("aceita skills add e mcp add com um id", () => {
    expect(extensionFrom(["skills", "add", "revisar-diff"])).toEqual({ kind: "skill", id: "revisar-diff" });
    expect(extensionFrom(["mcp", "add", "github"])).toEqual({ kind: "mcp", id: "github" });
  });

  it("recusa uso errado e id com caracteres estranhos", () => {
    expect(() => extensionFrom(["skills", "remove", "x"])).toThrow(/uso inválido/);
    expect(() => extensionFrom(["mcp", "add", "../x"])).toThrow(/id inválido/);
  });
});

describe("luna skills add", () => {
  it("recusa a skill se algum arquivo não bate com o sha256", () => {
    const bad = { ...skill, files: [{ ...skill.files[0], content: content + " mudado" }] };
    expect(() => checkSkill({ skills: [bad] }, "x")).toThrow(/sha256/);
  });

  it("grava nas duas CLIs e recusa se já existir", () => {
    const home = mkdtempSync(join(tmpdir(), "luna-skill-"));
    installSkill({ home, entry: skill, fs: realFs });

    expect(readFileSync(join(home, ".claude/skills/x/SKILL.md"), "utf8")).toBe(content);
    expect(existsSync(join(home, ".codex/skills/x/SKILL.md"))).toBe(true);
    expect(() => installSkill({ home, entry: skill, fs: realFs })).toThrow(/já está/);
  });
});

describe("luna mcp add", () => {
  const stdio = { id: "github", transport: "stdio", command: "npx", args: ["-y", "srv"], env: [{ key: "GITHUB_TOKEN", label: "Token" }] };
  const http = { id: "context7", transport: "http", url: "https://mcp.context7.com/mcp", env: [] };

  it("monta o comando de cada CLI com as variáveis", () => {
    const commands = mcpCommands(stdio, { GITHUB_TOKEN: "abc" });
    expect(commands.claude).toEqual(["mcp", "add", "--scope", "user", "-e", "GITHUB_TOKEN=abc", "github", "--", "npx", "-y", "srv"]);
    expect(commands.codex).toEqual(["mcp", "add", "github", "--env", "GITHUB_TOKEN=abc", "--", "npx", "-y", "srv"]);
  });

  it("servidor remoto usa a URL nas duas CLIs", () => {
    const commands = mcpCommands(http, {});
    expect(commands.claude).toContain("https://mcp.context7.com/mcp");
    expect(commands.codex).toEqual(["mcp", "add", "context7", "--url", "https://mcp.context7.com/mcp"]);
  });

  it("aponta variável faltando e valor com caractere perigoso", () => {
    expect(missingEnv(stdio, {}).map((f) => f.key)).toEqual(["GITHUB_TOKEN"]);
    expect(invalidValues(stdio, { GITHUB_TOKEN: "a&b" })).toEqual(["GITHUB_TOKEN"]);
    expect(invalidValues(stdio, { GITHUB_TOKEN: "ghp_abc123" })).toEqual([]);
  });

  it("uma CLI ausente não impede a outra, e cada resultado é informado", () => {
    const run = (engine) => (engine === "claude" ? { status: 0 } : { error: { code: "ENOENT" } });
    const results = installMcp({ entry: http, values: {}, run });
    expect(results.claude).toBe("ok");
    expect(results.codex).toMatch(/não está instalado/);
  });
});
