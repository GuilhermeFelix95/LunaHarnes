/// Caracteres por token usados na estimativa: o provedor não informa tokens por evento de texto.
const CHARS_PER_TOKEN = 4;

/// Tokens por segundo estimados a partir dos caracteres recebidos. Null enquanto não há tempo decorrido.
export function estimateTokensPerSecond(chars: number, elapsedMs: number): number | null {
  if (elapsedMs <= 0) return null;
  return Math.round(chars / CHARS_PER_TOKEN / (elapsedMs / 1000));
}

const SHOW_SPEED_KEY = "luna.chat.showSpeed";

/// Opção de ver a velocidade durante a resposta. Vem desligada.
export function readShowSpeed(): boolean {
  try {
    return localStorage.getItem(SHOW_SPEED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveShowSpeed(on: boolean): void {
  try {
    localStorage.setItem(SHOW_SPEED_KEY, on ? "1" : "0");
  } catch {
    // Sem armazenamento, a escolha vale só nesta sessão.
  }
}
