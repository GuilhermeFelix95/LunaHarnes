#!/usr/bin/env node
// Comando `luna`.
// - `luna`: compila e abre a versão estável, uma cópia separada do app, sem hot reload. Editar o código do
//   LunaHarness (inclusive pela própria Luna) não reinicia nem recarrega o app aberto. Se a compilação falhar,
//   abre a última cópia que funcionou.
// - `luna dev`: modo de desenvolvimento, com hot reload e sempre com o código atual.
// Roda neste terminal: os logs aparecem aqui e Ctrl+C fecha o app.
import * as fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { modeFrom, pickExecutable } from "./luna-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let mode;
try {
  mode = modeFrom(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

/// Roda e repassa o código de saída. `shell` é preciso no Windows, onde o npm é um .cmd.
function runAttached(command, options = {}) {
  const child = spawn(command, { cwd: root, stdio: "inherit", shell: true, ...options });
  child.on("exit", (code) => process.exit(code ?? 0));
}

if (mode === "dev") {
  runAttached("npm run dev:app");
} else {
  // Pasta de compilação própria: não briga com o target/debug do modo dev nem com um app aberto.
  const targetDir = join(root, "src-tauri", "target", "luna");
  const runDir = join(root, "src-tauri", "target", "luna-run");
  const config = join(root, "src-tauri", "tauri.luna.conf.json");

  console.log("luna: compilando a versão estável...");
  const build = spawnSync(`scripts\\with-msvc.cmd npx tauri build --debug --no-bundle --config "${config}"`, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, CARGO_TARGET_DIR: targetDir },
  });
  const built = build.status === 0 ? join(targetDir, "debug", "lunaharness.exe") : null;
  if (built && !fs.existsSync(built)) {
    console.error(`luna: a compilação terminou, mas ${built} não existe.`);
    process.exit(1);
  }

  const picked = pickExecutable({ built, runDir, fs });
  if (!picked) {
    console.error("luna: a compilação falhou e ainda não há versão anterior para abrir. Corrija o erro acima ou use `luna dev`.");
    process.exit(1);
  }
  if (picked.fallback) {
    console.warn("luna: a compilação falhou (erro acima). Abrindo a última versão que funcionou.");
  }
  console.log(`luna: abrindo ${picked.path}`);
  runAttached(`"${picked.path}"`);
}
