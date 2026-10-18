// Cache de prefixo do provedor: quantos tokens de entrada de cada turno vieram do cache.
// Diferente do cache de respostas (responseCache.ts), aqui o provedor cobra menos pelo que lê do cache.

/// Tokens de entrada de um turno. `null` = o provedor não informou aquele campo (não é zero).
export interface CacheUsage {
  fresh: number | null;
  read: number | null;
  write: number | null;
}

/// Taxa de acerto de um turno: lidos ÷ (novos + gravados + lidos). Sem leitura informada, não há taxa.
export function hitRate(usage: CacheUsage): number | null {
  if (usage.read === null) return null;
  const total = usage.read + (usage.fresh ?? 0) + (usage.write ?? 0);
  return total === 0 ? null : usage.read / total;
}

/// Taxa somada de vários turnos, pesada pelos tokens. Turnos sem leitura informada ficam de fora.
export function aggregateRate(turns: CacheUsage[]): number | null {
  let read = 0;
  let total = 0;
  for (const t of turns) {
    if (t.read === null) continue;
    read += t.read;
    total += t.read + (t.fresh ?? 0) + (t.write ?? 0);
  }
  return total === 0 ? null : read / total;
}

/// Tempo de vida do cache do provedor, em ms. Anthropic: 5 min padrão; 1 h quando ligado.
export const CACHE_TTL_MS = { short: 5 * 60_000, long: 60 * 60_000 };

export interface TurnRecord {
  usage: CacheUsage;
  /// Momento em que o turno terminou.
  at: number;
  model: string;
  /// Hash do prompt de sistema usado no turno; muda quando a identidade muda.
  systemKey: string;
  sessionId: string | null;
}

export type Diagnosis = "aquecendo" | "sessao-nova" | "modelo-trocado" | "prompt-mudou" | "pausa" | "desconhecido" | null;

/// Motivo mais provável de um acerto baixo, na ordem de prioridade. `null` = acerto bom ou sem dados.
/// O primeiro turno da sessão aparece como "aquecendo": o cache ainda não tem o que ler.
export function diagnose(previous: TurnRecord | null, current: TurnRecord, longTtl: boolean): Diagnosis {
  const rate = hitRate(current.usage);
  if (rate === null || rate >= 0.5) return null;
  if (!previous) return "aquecendo";
  if (previous.sessionId !== current.sessionId) return "sessao-nova";
  if (previous.model !== current.model) return "modelo-trocado";
  if (previous.systemKey !== current.systemKey) return "prompt-mudou";
  const ttl = longTtl ? CACHE_TTL_MS.long : CACHE_TTL_MS.short;
  if (current.at - previous.at > ttl) return "pausa";
  return "desconhecido";
}
