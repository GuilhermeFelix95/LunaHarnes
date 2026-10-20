import { mkdtempSync, readFileSync, writeFileSync, utimesSync } from "node:fs";
import * as realFs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lastCopy, modeFrom, pickExecutable } from "./luna-lib.mjs";

/// Pasta temporária com um exe "compilado" falso.
function setup() {
  const root = mkdtempSync(join(tmpdir(), "luna-"));
  const built = join(root, "lunacode.exe");
  writeFileSync(built, "versão nova");
  return { root, built, runDir: join(root, "luna-run") };
}

/// fs real, mas a cópia padrão finge estar aberta (travada pelo Windows).
const lockedFs = {
  ...realFs,
  copyFileSync(source, target) {
    if (target.endsWith(join("luna-run", "lunacode.exe"))) throw Object.assign(new Error("busy"), { code: "EBUSY" });
    realFs.copyFileSync(source, target);
  },
};

describe("modeFrom", () => {
  it("sem argumentos abre a versão estável, e dev abre o modo de desenvolvimento", () => {
    expect(modeFrom([])).toBe("stable");
    expect(modeFrom(["dev"])).toBe("dev");
  });

  it("argumento desconhecido explica o uso", () => {
    expect(() => modeFrom(["build"])).toThrow(/Uso:/);
  });
});

describe("pickExecutable", () => {
  it("compilou: abre uma cópia, não o exe que a próxima compilação sobrescreve", () => {
    const { built, runDir } = setup();

    const picked = pickExecutable({ built, runDir, fs: realFs });

    expect(picked).toEqual({ path: join(runDir, "lunacode.exe"), fallback: false });
    expect(readFileSync(picked.path, "utf8")).toBe("versão nova");
  });

  it("com outro luna aberto, a cópia vai para um nome com horário", () => {
    const { built, runDir } = setup();

    const picked = pickExecutable({ built, runDir, fs: lockedFs, now: 123 });

    expect(picked.path).toBe(join(runDir, "lunacode-123.exe"));
  });

  it("compilação falhou: abre a última cópia que funcionou", () => {
    const { built, runDir } = setup();
    pickExecutable({ built, runDir, fs: realFs });

    expect(pickExecutable({ built: null, runDir, fs: realFs })).toEqual({ path: join(runDir, "lunacode.exe"), fallback: true });
  });

  it("compilação falhou e nunca houve cópia: não há o que abrir", () => {
    const { runDir } = setup();

    expect(pickExecutable({ built: null, runDir, fs: realFs })).toBeNull();
  });
});

describe("lastCopy", () => {
  it("escolhe a cópia mais recente e ignora outros arquivos", () => {
    const { built, runDir } = setup();
    pickExecutable({ built, runDir, fs: realFs });
    pickExecutable({ built, runDir, fs: lockedFs, now: 456 });
    writeFileSync(join(runDir, "notas.txt"), "x");
    utimesSync(join(runDir, "lunacode.exe"), new Date(2020, 0, 1), new Date(2020, 0, 1));

    expect(lastCopy(runDir, realFs)).toBe(join(runDir, "lunacode-456.exe"));
  });
});
