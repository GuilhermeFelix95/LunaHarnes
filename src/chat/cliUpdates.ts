import { cliUpdateCheck } from "../api";
import type { CliUpdateInfo } from "../types";

/// Checagem a cada hora, no mesmo ritmo da checagem de atualização do próprio app (ver src/updates.ts).
export const CLI_CHECK_EVERY_MS = 60 * 60 * 1000;

/// Só CLIs com versão nova e sem erro entram no aviso. Com o agente rodando, nenhum aviso aparece.
export function updatesToShow(infos: CliUpdateInfo[], running: boolean): CliUpdateInfo[] {
  if (running) return [];
  return infos.filter((info) => info.updateAvailable && !info.error);
}

/// Checa depois de um atraso inicial e depois a cada hora. Falha de consulta não vira erro na tela.
export function startCliUpdateChecks(onResult: (infos: CliUpdateInfo[]) => void, firstDelayMs = 8000): () => void {
  const check = () => {
    cliUpdateCheck().then(onResult, () => {});
  };
  const first = window.setTimeout(check, firstDelayMs);
  const every = window.setInterval(check, CLI_CHECK_EVERY_MS);
  return () => {
    window.clearTimeout(first);
    window.clearInterval(every);
  };
}
