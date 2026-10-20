// Comandos `luna skills add <id>`, `luna mcp add <id>` e `luna plugin add <id>`, com as regras separadas do
// terminal para dar para testar. Usam os mesmos catálogos do app (src-tauri/marketplace).
// Skill grava as pastas nas duas CLIs. MCP não é gravado aqui: o `luna mcp add` chama o app (lunacode.exe mcp add),
// que grava só o nome das variáveis, nunca o valor. Plugin grava na pasta de dados do app, como a instalação pela tela.
import { createHash } from "node:crypto";
import { join } from "node:path";

export const EXTENSIONS_USAGE = [
  "Uso:",
  "  luna skills add <id>   instala uma skill do marketplace nas duas CLIs",
  "  luna mcp add <id>      instala um servidor MCP pelo app (só grava o nome das variáveis de ambiente)",
  "  luna plugin add <id>   instala um plugin do marketplace na pasta de dados do app",
].join("\n");

const APP_ID = "dev.lunacode.app";
const SKILL_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SAFE_PATH = /^[A-Za-z0-9_\-./]+$/;

const KINDS = { skills: "skill", mcp: "mcp", plugin: "plugin" };

/// `{ kind, id }` para `skills|mcp|plugin add <id>`. Qualquer outra coisa é erro, com a ajuda.
export function extensionFrom(argv) {
  const [kind, action, id, ...rest] = argv;
  if (!Object.hasOwn(KINDS, kind) || action !== "add" || !id || rest.length > 0) {
    throw new Error(`uso inválido: ${argv.join(" ")}\n${EXTENSIONS_USAGE}`);
  }
  if (!SKILL_ID.test(id)) throw new Error(`id inválido: ${id}`);
  return { kind: KINDS[kind], id };
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

/// Pasta de dados do app (a mesma que o Tauri usa para `app_data_dir`). Recebe a plataforma e o ambiente para testar.
export function appDataDir({ platform, env, home }) {
  if (platform === "win32") return join(env.APPDATA ?? join(home, "AppData", "Roaming"), APP_ID);
  if (platform === "darwin") return join(home, "Library", "Application Support", APP_ID);
  return join(env.XDG_DATA_HOME ?? join(home, ".local", "share"), APP_ID);
}

/// Confere o plugin antes de gravar: caminhos seguros, arquivos presentes e sha256 de cada um.
export function checkPlugin(catalog, id) {
  const entry = catalog.plugins.find((p) => p.id === id);
  if (!entry) throw new Error(`plugin "${id}" não está no catálogo`);
  if (!entry.files.some((f) => f.path === entry.entry)) throw new Error(`o plugin "${id}" não tem o arquivo de entrada ${entry.entry}`);
  for (const file of entry.files) {
    const segments = file.path.split("/");
    if (!SAFE_PATH.test(file.path) || segments.some((s) => s === "" || s === "." || s === "..") || file.path === "manifest.json") {
      throw new Error(`caminho de arquivo inválido no plugin "${id}": ${file.path}`);
    }
    if (typeof file.content !== "string") throw new Error(`o arquivo ${file.path} do plugin "${id}" não vem no catálogo; instale pelo app`);
    if (sha256(file.content) !== file.sha256) {
      throw new Error(`o arquivo ${file.path} do plugin "${id}" não bate com o sha256 do catálogo; nada foi instalado`);
    }
  }
  return entry;
}

/// Grava o plugin em `<appDir>/plugins/<id>`. Prepara numa pasta de staging e só depois renomeia, como o app.
export function installPlugin({ appDir, entry, fs }) {
  const pluginsDir = join(appDir, "plugins");
  const target = join(pluginsDir, entry.id);
  if (fs.existsSync(target)) throw new Error(`o plugin "${entry.id}" já está instalado em ${target}`);
  const staging = join(appDir, `plugin-staging-${entry.id}`);
  fs.rmSync(staging, { recursive: true, force: true });
  try {
    for (const file of entry.files) {
      const path = join(staging, file.path);
      fs.mkdirSync(join(path, ".."), { recursive: true });
      fs.writeFileSync(path, file.content, "utf8");
    }
    const manifest = {
      id: entry.id,
      name: entry.name,
      version: entry.version,
      entry: entry.entry,
      permissions: entry.permissions ?? [],
    };
    fs.writeFileSync(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    fs.mkdirSync(pluginsDir, { recursive: true });
    fs.renameSync(staging, target);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  return target;
}

