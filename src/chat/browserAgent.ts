import type { RoleModel } from "./orchestrator";

const KEY = "luna.browserAgent";

/// Motor, perfil e modelo do chat no modo navegador, escolhidos em Configurações > Navegador.
/// Sem escolha, o chat do navegador segue a conversa, como o LunaCode.
export function getBrowserAgent(): RoleModel | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as RoleModel;
    return typeof parsed.provider === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function setBrowserAgent(choice: RoleModel | undefined) {
  try {
    if (choice) localStorage.setItem(KEY, JSON.stringify(choice));
    else localStorage.removeItem(KEY);
  } catch {
    // Sem armazenamento (janela privada, dados bloqueados): a escolha vale só até fechar o app.
  }
}
