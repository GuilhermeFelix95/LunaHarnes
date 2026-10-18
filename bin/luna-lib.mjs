// Regras do comando `luna`, sem compilar nem abrir nada: assim dá para testar.
import { join } from "node:path";

export const USAGE = [
  "Uso:",
  "  luna       compila e abre a versão estável (uma cópia separada, sem hot reload)",
  "  luna dev   abre em modo de desenvolvimento, com hot reload",
].join("\n");

const RUN_NAME = "lunaharness.exe";
const RUN_PATTERN = /^lunaharness(-\d+)?\.exe$/;

/// `stable` sem argumentos, `dev` com `dev`. Qualquer outra coisa é erro, com a ajuda.
export function modeFrom(argv) {
  if (argv.length === 0) return "stable";
  if (argv.length === 1 && argv[0] === "dev") return "dev";
  throw new Error(`argumento desconhecido: ${argv.join(" ")}\n${USAGE}`);
}

/// Windows trava o exe de um app aberto: copiar por cima falha com um destes códigos.
function isLocked(error) {
  return ["EBUSY", "EPERM", "EACCES"].includes(error?.code);
}

/// Copia o exe compilado para a pasta de execução. O app aberto usa a cópia, nunca o exe que a próxima
/// compilação sobrescreve. Se a cópia padrão estiver em uso (outro luna aberto), usa um nome com horário.
export function copyForRun(source, runDir, fs, now = Date.now()) {
  fs.mkdirSync(runDir, { recursive: true });
  const main = join(runDir, RUN_NAME);
  try {
    fs.copyFileSync(source, main);
    return main;
  } catch (error) {
    if (!isLocked(error)) throw error;
    const alternate = join(runDir, `lunaharness-${now}.exe`);
    fs.copyFileSync(source, alternate);
    return alternate;
  }
}

/// A cópia mais recente que já abriu antes, ou null quando não há nenhuma.
export function lastCopy(runDir, fs) {
  if (!fs.existsSync(runDir)) return null;
  const copies = fs
    .readdirSync(runDir)
    .filter((name) => RUN_PATTERN.test(name))
    .map((name) => ({ path: join(runDir, name), time: fs.statSync(join(runDir, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  return copies[0]?.path ?? null;
}

/// Qual exe abrir. Compilou: copia e abre a versão nova. Falhou: abre a última cópia boa, avisando.
/// Sem compilação e sem cópia, devolve null.
export function pickExecutable({ built, runDir, fs, now }) {
  if (built) return { path: copyForRun(built, runDir, fs, now), fallback: false };
  const previous = lastCopy(runDir, fs);
  return previous ? { path: previous, fallback: true } : null;
}
