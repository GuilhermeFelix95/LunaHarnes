import type { AgentBrowser } from "../types";

const KEY = "luna.agentBrowser";

/// Navegador que o agente usa, escolhido em Configurações. Padrão: o embutido do Luna.
export function getAgentBrowser(): AgentBrowser {
  try {
    return localStorage.getItem(KEY) === "playwright" ? "playwright" : "builtin";
  } catch {
    return "builtin";
  }
}

export function setAgentBrowser(choice: AgentBrowser) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Sem armazenamento (janela privada, dados bloqueados): a escolha vale só até fechar o app.
  }
}
