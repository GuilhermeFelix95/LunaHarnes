// Comandos `luna skills add <id>` e `luna mcp add <id>`, com as regras separadas do terminal para dar para testar.
// Usam os mesmos catálogos do app (src-tauri/marketplace). Skill grava as pastas nas duas CLIs.
// MCP usa `claude mcp add` e `codex mcp add`, os comandos oficiais de cada CLI, em vez de editar os arquivos.
import { createHash } from "node:crypto";
import { join } from "node:path";

export const EXTENSIONS_USAGE = [
  "Uso:",
  "  luna skills add <id>   instala uma skill do marketplace nas duas CLIs",
  "  luna mcp add <id>      instala um servidor MCP com `claude mcp add` e `codex mcp add`",
].join("\n");

const SKILL_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ENV_KEY = /^[A-Z_][A-Z0-9_]*$/;
// Valores digitados pelo usuário: só caracteres que o shell não interpreta. Assim não precisa de aspas.
const SAFE_VALUE = /^[A-Za-z0-9_\-.:\/+=@]+$/;

/// `{ kind, id }` para `skills add <id>` e `mcp add <id>`. Qualquer outra coisa é erro, com a ajuda.
export function extensionFrom(argv) {
  const [kind, action, id, ...rest] = argv;
  if (!["skills", "mcp"].includes(kind) || action !== "add" || !id || rest.length > 0) {
    throw new Error(`uso inválido: ${argv.join(" ")}\n${EXTENSIONS_USAGE}`);
  }
  if (!SKILL_ID.test(id)) throw new Error(`id inválido: ${id}`);
  return { kind: kind === "skills" ? "skill" : "mcp", id };
}

export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/// Confere todos os arquivos da skill contra o sha256 do catálogo. Devolve a entrada se estiver certa.
export function checkSkill(catalog, id) {
  const entry = catalog.skills.find((s) => s.id === id);
  if (!entry) throw new Error(`skill "${id}" não está no catálogo`);
  for (const file of entry.files) {
    if (sha256(file.content) !== file.sha256) {
      throw new Error(`o arquivo ${file.path} da skill "${id}" não bate com o sha256 do catálogo; nada foi instalado`);
    }
  }
  if (!entry.files.some((f) => f.path === "SKILL.md")) throw new Error(`a skill "${id}" não tem SKILL.md`);
  return entry;
}

/// Grava a skill em ~/.claude/skills e ~/.codex/skills. Recusa se já existir em alguma delas.
export function installSkill({ home, entry, fs }) {
  const roots = [join(home, ".claude", "skills"), join(home, ".codex", "skills")];
  for (const root of roots) {
    if (fs.existsSync(join(root, entry.id))) throw new Error(`a skill "${entry.id}" já está em ${root}`);
  }
  for (const root of roots) {
    const staging = join(root, `.luna-staging-${entry.id}`);
    fs.rmSync(staging, { recursive: true, force: true });
    for (const file of entry.files) {
      const path = join(staging, file.path);
      fs.mkdirSync(join(path, ".."), { recursive: true });
      fs.writeFileSync(path, file.content, "utf8");
    }
    fs.renameSync(staging, join(root, entry.id));
  }
  return roots.map((root) => join(root, entry.id));
}

/// Campos de ambiente pedidos pelo catálogo que ainda não têm valor.
export function missingEnv(entry, values) {
  return entry.env.filter((field) => !values[field.key]);
}

/// Chaves com nome ou valor que não podem ir para o comando (ou que o catálogo não pediu).
export function invalidValues(entry, values) {
  return Object.entries(values)
    .filter(([key, value]) => !ENV_KEY.test(key) || !SAFE_VALUE.test(value) || !entry.env.some((f) => f.key === key))
    .map(([key]) => key);
}

/// Argumentos do `claude mcp add` e do `codex mcp add` para este servidor.
export function mcpCommands(entry, values) {
  const envFor = (flag) => Object.entries(values).flatMap(([key, value]) => [flag, `${key}=${value}`]);
  if (entry.transport === "http") {
    return {
      claude: ["mcp", "add", "--transport", "http", "--scope", "user", entry.id, entry.url],
      codex: ["mcp", "add", entry.id, "--url", entry.url],
    };
  }
  return {
    claude: ["mcp", "add", "--scope", "user", ...envFor("-e"), entry.id, "--", entry.command, ...entry.args],
    codex: ["mcp", "add", entry.id, ...envFor("--env"), "--", entry.command, ...entry.args],
  };
}

/// Roda o comando de cada CLI. `run(engine, args)` devolve { status, error }. Uma CLI ausente não impede a outra.
export function installMcp({ entry, values, run }) {
  const commands = mcpCommands(entry, values);
  const results = {};
  for (const engine of ["claude", "codex"]) {
    const result = run(engine, commands[engine]);
    if (result.error?.code === "ENOENT") {
      results[engine] = `${engine} não está instalado; o servidor não foi adicionado nesta CLI`;
    } else if (result.status !== 0) {
      results[engine] = `${engine} recusou o comando (código ${result.status})`;
    } else {
      results[engine] = "ok";
    }
  }
  return results;
}
