import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { stopAllForUpdate } from "./api";

/** Uma versão nova encontrada no endereço de releases, pronta para instalar. */
export interface AvailableUpdate {
  version: string;
  notes: string;
  install: () => Promise<void>;
}

export function currentVersion(): Promise<string> {
  return getVersion();
}

/** Procura uma versão nova. `null` quer dizer que já está na mais recente. Falha de rede ou assinatura inválida lança erro. */
export async function findUpdate(): Promise<AvailableUpdate | null> {
  const update = await check();
  return update ? toAvailable(update) : null;
}

function toAvailable(update: Update): AvailableUpdate {
  return {
    version: update.version,
    notes: update.body ?? "",
    install: async () => {
      await stopAllForUpdate();
      await update.downloadAndInstall();
      await relaunch();
    },
  };
}
