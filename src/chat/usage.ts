/// Formatação do uso da conta e do contexto. Recebe os valores da CLI (ver providers/claude.rs).

/// Tokens por extenso, curtos: "44 mil", "1,0 mi".
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)} mil`;
  return String(tokens);
}

/// Porcentagem de contexto ocupado, limitada a 0–100.
export function contextPercent(tokens: number, windowSize: number): number {
  if (windowSize <= 0) return 0;
  return Math.min(100, Math.round((tokens / windowSize) * 100));
}

/// `utilization` vem da CLI como fração (0 a 1). Converte para porcentagem limitada a 0–100.
export function utilizationPercent(utilization: number): number {
  return Math.min(100, Math.max(0, Math.round(utilization * 100)));
}

/// Horário de reset. A janela de 5 horas mostra a hora; a semanal mostra o dia da semana também.
export function formatReset(resetsAtSeconds: number, window: "fiveHour" | "sevenDay", locale = "pt-BR"): string {
  const date = new Date(resetsAtSeconds * 1000);
  if (window === "fiveHour") {
    return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleString(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" });
}
