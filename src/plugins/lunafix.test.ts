import { describe, expect, it } from "vitest";
import { PluginHost, type PluginManifest } from "./host";
// O plugin oficial é um JS fora de src/, sem declaração de tipos: o teste carrega o arquivo real.
// @ts-expect-error -- módulo JS do plugin oficial, sem tipos
import * as lunafix from "../../plugins-examples/lunafix/index.js";

// Mesmas permissões do manifest.json do plugin.
const manifest: PluginManifest = {
  id: "lunafix",
  name: "LunaFix",
  version: "0.1.0",
  entry: "index.js",
  permissions: ["autofix"],
};

const turn = (lastCommand: { ok: boolean; output: string } | null) => ({ text: "pronto", ok: true, lastCommand, attempt: 0 });

describe("LunaFix", () => {
  it("comando que falhou: pede a correção com a saída do erro", async () => {
    const host = new PluginHost();
    await host.load(manifest, async () => lunafix);

    const fix = await host.runTurnDone(turn({ ok: false, output: "Exit code 1\nteste falhou" }));

    expect(fix).toContain("Exit code 1");
    expect(fix).toContain("Rode o mesmo comando de novo");
  });

  it("comando que passou, ou nenhum comando: não pede nada", async () => {
    const host = new PluginHost();
    await host.load(manifest, async () => lunafix);

    expect(await host.runTurnDone(turn({ ok: true, output: "ok" }))).toBeNull();
    expect(await host.runTurnDone(turn(null))).toBeNull();
  });
});
