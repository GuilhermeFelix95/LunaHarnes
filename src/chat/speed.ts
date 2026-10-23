/// Velocidade medida: tokens de saída do turno ÷ tempo desde o primeiro texto da resposta.
/// Null enquanto não há início medido ou tempo decorrido.
export function tokensPerSecond(tokens: number, startedAt: number | null, now: number): number | null {
  if (startedAt === null || now <= startedAt) return null;
  return Math.round(tokens / ((now - startedAt) / 1000));
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
