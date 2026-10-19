import { describe, expect, it } from "vitest";
import { PluginHost, type PluginManifest } from "./host";
// O plugin de exemplo é um JS fora de src/, sem declaração de tipos: o teste carrega o arquivo real.
// @ts-expect-error -- módulo JS do plugin de exemplo, sem tipos
import * as gameboy from "../../plugins-examples/gameboy-theme/index.js";

// Mesmas permissões do manifest.json do plugin de exemplo.
const manifest: PluginManifest = {
  id: "gameboy-theme",
  name: "Game Boy",
  version: "0.1.0",
  entry: "index.js",
  permissions: ["theme"],
};

describe("plugin de exemplo gameboy-theme", () => {
  it("registra o tema com a paleta de quatro verdes e CSS próprio", async () => {
    const host = new PluginHost();

    expect(await host.load(manifest, async () => gameboy)).toBe(true);
    const [theme] = host.themeList();
    expect(theme.id).toBe("gameboy");
    expect(theme.dark).toBe(false);
    expect(Object.keys(theme.tokens)).toEqual(expect.arrayContaining(["--bg", "--fg", "--border"]));
    expect(theme.css).toContain("monospace");
  });
});
