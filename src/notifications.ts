import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

export const NOTIFY_KEY = "luna:notifications";

/// Ligadas por padrão; Configurações desliga. Sem armazenamento, vale só nesta janela.
export function notificationsEnabled(): boolean {
  try {
    return localStorage.getItem(NOTIFY_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setNotificationsEnabled(on: boolean) {
  try {
    localStorage.setItem(NOTIFY_KEY, on ? "on" : "off");
  } catch {
    // Sem armazenamento a escolha some ao fechar a janela; o padrão continua valendo.
  }
}

/// Avisa só quando a janela não está em foco: resposta pronta, erro ou plano esperando revisão.
/// Fora do app (navegador de teste) não há sistema de avisos: o aviso é descartado.
export async function notifyIfUnfocused(title: string, body: string): Promise<void> {
  if (!notificationsEnabled() || document.hasFocus()) return;
  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (granted) sendNotification({ title, body });
  } catch {
    // Permissão negada ou sistema sem avisos: a resposta continua na tela normalmente.
  }
}
