/// Última pasta de projeto usada. O app reabre nela, em vez da pasta de onde o `luna` foi rodado.
export const LAST_WORKSPACE_KEY = "luna.lastWorkspace";

export function loadLastWorkspace(): string | undefined {
  try {
    return localStorage.getItem(LAST_WORKSPACE_KEY) || undefined;
  } catch {
    // Armazenamento indisponível: volta à pasta padrão.
    return undefined;
  }
}

export function saveLastWorkspace(cwd: string) {
  if (!cwd) return;
  try {
    localStorage.setItem(LAST_WORKSPACE_KEY, cwd);
  } catch {
    // Sem armazenamento, a pasta vale só nesta sessão.
  }
}
