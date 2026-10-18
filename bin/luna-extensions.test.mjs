import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import * as realFs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appDataDir,
  checkPlugin,
  checkSkill,
  extensionFrom,
  installPlugin,
  installSkill,
  sha256,
} from "./luna-extensions.mjs";

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

const pluginCode = "export function activate(api) {}\n";
const plugin = {
  id: "exemplo",
  name: "Exemplo",
  version: "1.0.0",
  entry: "index.js",
  permissions: ["modes"],
  files: [{ path: "index.js", sha256: sha256(pluginCode), content: pluginCode }],
};
const pluginCatalog = { plugins: [plugin] };

describe("luna plugin add", () => {
  it("aceita plugin add com um id", () => {
    expect(extensionFrom(["plugin", "add", "exemplo"])).toEqual({ kind: "plugin", id: "exemplo" });
  });

  it("acha a pasta de dados do app em cada sistema", () => {
    expect(appDataDir({ platform: "win32", env: { APPDATA: "C:\\R" }, home: "C:\\u" })).toBe(
      join("C:\\R", "dev.lunaharness.app"),
    );
    expect(appDataDir({ platform: "win32", env: {}, home: "/h" })).toBe(join("/h", "AppData", "Roaming", "dev.lunaharness.app"));
    expect(appDataDir({ platform: "linux", env: {}, home: "/h" })).toBe(join("/h", ".local", "share", "dev.lunaharness.app"));
  });

  it("recusa arquivo com sha256 errado, caminho com .. e entrada que não existe", () => {
    const bad = { ...plugin, files: [{ ...plugin.files[0], content: pluginCode + "//x" }] };
    expect(() => checkPlugin({ plugins: [bad] }, "exemplo")).toThrow(/sha256/);
    const escape = { ...plugin, files: [plugin.files[0], { path: "../fora.js", sha256: sha256("x"), content: "x" }] };
    expect(() => checkPlugin({ plugins: [escape] }, "exemplo")).toThrow(/caminho/);
    const noEntry = { ...plugin, entry: "outro.js" };
    expect(() => checkPlugin({ plugins: [noEntry] }, "exemplo")).toThrow(/entrada/);
  });

  it("grava manifest e arquivos na pasta do app e recusa se já existir", () => {
    const appDir = mkdtempSync(join(tmpdir(), "luna-plugin-"));
    const entry = checkPlugin(pluginCatalog, "exemplo");
    const target = installPlugin({ appDir, entry, fs: realFs });
    expect(readFileSync(join(target, "index.js"), "utf8")).toBe(pluginCode);
    expect(JSON.parse(readFileSync(join(target, "manifest.json"), "utf8"))).toEqual({
      id: "exemplo",
      name: "Exemplo",
      version: "1.0.0",
      entry: "index.js",
      permissions: ["modes"],
    });
    expect(existsSync(join(appDir, "plugin-staging-exemplo"))).toBe(false);
    expect(() => installPlugin({ appDir, entry, fs: realFs })).toThrow(/já está instalado/);
  });
});
