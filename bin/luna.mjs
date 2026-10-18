#!/usr/bin/env node
// Comando `luna`: abre o LunaHarness em modo de desenvolvimento, com hot reload e sempre com o código atual.
// Roda neste terminal: os logs aparecem aqui e Ctrl+C fecha o app.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// `shell` é preciso no Windows, onde o npm é um .cmd.
const child = spawn("npm", ["run", "dev:app"], { cwd: root, stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
