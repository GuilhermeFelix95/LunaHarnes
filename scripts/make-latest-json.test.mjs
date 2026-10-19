import { describe, expect, it } from "vitest";
import { buildLatest, installerName } from "./make-latest-json.mjs";

describe("buildLatest", () => {
  it("monta o latest.json no formato do atualizador do Tauri para Windows x64", () => {
    const latest = buildLatest({
      version: "0.1.1",
      notes: "Correções",
      pubDate: "2026-10-18T12:00:00.000Z",
      signature: "assinatura-minisign",
      url: "https://github.com/GuilhermeFelix95/LunaHarnes/releases/download/v0.1.1/LunaHarness_0.1.1_x64-setup.exe",
    });

    expect(latest).toEqual({
      version: "0.1.1",
      notes: "Correções",
      pub_date: "2026-10-18T12:00:00.000Z",
      platforms: {
        "windows-x86_64": {
          signature: "assinatura-minisign",
          url: "https://github.com/GuilhermeFelix95/LunaHarnes/releases/download/v0.1.1/LunaHarness_0.1.1_x64-setup.exe",
        },
      },
    });
  });

  it("recusa versão sem formato x.y.z", () => {
    expect(() => buildLatest({ version: "v0.1", notes: "", pubDate: "", signature: "s", url: "https://x" })).toThrow(
      /versão/,
    );
  });

  it("recusa assinatura vazia, para não publicar um release que o app não consegue validar", () => {
    expect(() => buildLatest({ version: "0.1.1", notes: "", pubDate: "", signature: "  ", url: "https://x" })).toThrow(
      /assinatura/,
    );
  });
});

describe("installerName", () => {
  it("acha o instalador NSIS entre os arquivos do build", () => {
    expect(
      installerName(["LunaHarness_0.1.1_x64-setup.exe", "LunaHarness_0.1.1_x64-setup.exe.sig", "latest.json"]),
    ).toBe("LunaHarness_0.1.1_x64-setup.exe");
  });

  it("falha quando não há instalador ou há mais de um", () => {
    expect(() => installerName(["latest.json"])).toThrow(/instalador/);
    expect(() => installerName(["a-setup.exe", "b-setup.exe"])).toThrow(/instalador/);
  });
});
