#!/usr/bin/env node
// Comando `luna`: abre o LunaHarness a partir de qualquer pasta.
// Usa o executável já compilado (`npm run build:app`); não recompila nada.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const exeName = process.platform === "win32" ? "lunaharness.exe" : "lunaharness";
const exe = join(root, "src-tauri", "target", "release", exeName);

if (!existsSync(exe)) {
  console.error(
    `O LunaHarness ainda não foi compilado. Rode "npm run build:app" em ${root}.`,
  );
  process.exit(1);
}

// Desvinculado do terminal: o app continua aberto mesmo depois de fechar este shell.
spawn(exe, { detached: true, stdio: "ignore" }).unref();
