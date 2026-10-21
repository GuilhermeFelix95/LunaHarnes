/// Caracteres por token usados na estimativa: o provedor não informa tokens por evento de texto.
const CHARS_PER_TOKEN = 4;

/// Tokens por segundo estimados a partir dos caracteres recebidos. Null enquanto não há tempo decorrido.
export function estimateTokensPerSecond(chars: number, elapsedMs: number): number | null {
  if (elapsedMs <= 0) return null;
  return Math.round(chars / CHARS_PER_TOKEN / (elapsedMs / 1000));
}
