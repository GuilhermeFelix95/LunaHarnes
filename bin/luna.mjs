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
import * as readline from "node:readline/promises";
import { homedir } from "node:os";
import { modeFrom, pickExecutable } from "./luna-lib.mjs";
import { appDataDir, checkPlugin, checkSkill, extensionFrom, installPlugin, installSkill } from "./luna-extensions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const CATALOG_FILES = { skill: "skills.json", plugin: "official.json" };

/// Executável que o `luna` compilou (o mesmo que ele abre). Usa o do modo estável se existir.
function lunaExecutable() {
  const name = process.platform === "win32" ? "lunaharness.exe" : "lunaharness";
  return [join(root, "src-tauri", "target", "luna", "debug", name), join(root, "src-tauri", "target", "debug", name)].find((p) =>
    fs.existsSync(p),
  );
}

/// `luna skills|mcp|plugin add <id>`: instala do marketplace do app e devolve o código de saída.
async function runExtension(argv) {
  let parsed;
  try {
    parsed = extensionFrom(argv);
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  if (parsed.kind === "mcp") return addMcp(parsed.id);
  const catalogFile = join(root, "src-tauri", "marketplace", CATALOG_FILES[parsed.kind]);
  const catalog = JSON.parse(fs.readFileSync(catalogFile, "utf8"));

  if (parsed.kind === "skill") {
    try {
      const entry = checkSkill({ skills: catalog.skills }, parsed.id);
      const dirs = installSkill({ home: homedir(), entry, fs });
      console.log(`Skill "${entry.name}" instalada em:\n${dirs.join("\n")}\nAparece no menu / na próxima conversa.`);
      return 0;
    } catch (error) {
      console.error(`luna: ${error.message}`);
      return 1;
    }
  }

  if (parsed.kind === "plugin") {
    let entry;
    try {
      entry = checkPlugin(catalog, parsed.id);
    } catch (error) {
      console.error(`luna: ${error.message}`);
      return 1;
    }
    // Plugin roda código no app: mostra as permissões e pede confirmação antes de gravar.
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      console.log(`\nPlugin "${entry.name}" v${entry.version} (${entry.files.length} arquivo(s)).`);
      console.log(`Permissões: ${entry.permissions.join(", ") || "nenhuma"}`);
      const answer = (await rl.question("Instalar? (s/N) ")).trim().toLowerCase();
      if (answer !== "s") {
        console.log("luna: cancelado. Nada foi alterado.");
        return 0;
      }
    } finally {
      rl.close();
    }
    try {
      const dir = installPlugin({
        appDir: appDataDir({ platform: process.platform, env: process.env, home: homedir() }),
        entry,
        fs,
      });
      console.log(`Plugin "${entry.name}" instalado em ${dir}.\nReinicie o app (ou reabra as configurações) para ver o plugin.`);
      return 0;
    } catch (error) {
      console.error(`luna: ${error.message}`);
      return 1;
    }
  }

  return 1;
}

/// MCP: quem grava é o próprio app (`lunaharness mcp add`), com a mesma lógica da tela. O luna não pede
/// nem grava valores: as variáveis são lidas do ambiente do usuário pela CLI.
function addMcp(id) {
  const exe = lunaExecutable();
  if (!exe) {
    console.error("luna: o app ainda não foi compilado. Rode `luna` uma vez e depois `luna mcp add <id>`.");
    return 1;
  }
  return spawnSync(exe, ["mcp", "add", id], { stdio: "inherit" }).status ?? 1;
}


if (["skills", "mcp", "plugin"].includes(process.argv[2])) {
  process.exit(await runExtension(process.argv.slice(2)));
}

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
