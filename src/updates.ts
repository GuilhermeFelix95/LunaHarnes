import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { stopAllForUpdate } from "./api";
import { t } from "./i18n";
import { showToast } from "./ui/toast";

/** Uma versão nova encontrada no endereço de releases, pronta para instalar. */
export interface AvailableUpdate {
  version: string;
  notes: string;
  install: () => Promise<void>;
}

/** Intervalo entre checagens enquanto o app está aberto (a checagem ao abrir é à parte). */
export const UPDATE_CHECK_EVERY_MS = 60 * 60 * 1000;

export function currentVersion(): Promise<string> {
  return getVersion();
}

/** Procura uma versão nova. `null` quer dizer que já está na mais recente. Falha de rede ou assinatura inválida lança erro. */
export async function findUpdate(): Promise<AvailableUpdate | null> {
  const update = await check();
  return update ? toAvailable(update) : null;
}

/// Checagem ao abrir o app: se houver versão nova, avisa na tela. Falha (sem rede, assinatura inválida) só vai para o console.
export async function checkOnStartup(): Promise<void> {
  try {
    const update = await findUpdate();
    if (update) showToast({ kind: "info", title: t("update.available", { version: update.version }), body: t("update.availableHint") });
  } catch (error) {
    console.warn("Checagem de atualização ao abrir falhou.", error);
  }
}

/// Checa ao abrir (depois de um atraso curto, para não competir com o carregamento) e a cada hora. Devolve a função que para as checagens.
export function startUpdateChecks(firstDelayMs = 5000): () => void {
  const first = window.setTimeout(() => void checkOnStartup(), firstDelayMs);
  const every = window.setInterval(() => void checkOnStartup(), UPDATE_CHECK_EVERY_MS);
  return () => {
    window.clearTimeout(first);
    window.clearInterval(every);
  };
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
