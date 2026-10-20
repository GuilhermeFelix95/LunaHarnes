import type { ProviderKind } from "../types";

// Cache de prefixo do provedor: quantos tokens de entrada de cada turno vieram do cache.
// O provedor cobra menos pelo que lê desse prefixo: é o cache que importa para o custo.

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

/// Estado do cache do provedor agora. Claude informa o TTL; Codex não informa, e sem leitura não há o que dizer.
export type CacheWarmth =
  | { state: "quente"; remainingMs: number }
  | { state: "frio" }
  | { state: "sem-ttl" }
  | { state: "sem-dados" };

export interface CacheSummary {
  /// Taxa da sessão inteira, pesada pelos tokens.
  session: number | null;
  /// Total de tokens de entrada lidos do cache na conversa.
  readTotal: number;
  /// Total de tokens novos (sem cache) e gravados no cache, na conversa.
  freshTotal: number;
  writeTotal: number;
  /// Último turno, com o motivo do acerto baixo (se houver).
  last: { rate: number | null; diagnosis: Diagnosis; model: string } | null;
  /// Taxas dos últimos 12 turnos, do mais antigo ao mais novo.
  history: (number | null)[];
  warm: CacheWarmth;
  /// Dica de ação, quando ela se aplica.
  tip: string | null;
}

/// Resume a conversa. `longTtl` = cache de 1 h ligado; `now` = momento da leitura (para o tempo que falta no cache).
export function summarize(
  turns: TurnRecord[],
  options: { provider: ProviderKind; longTtl: boolean; now: number },
): CacheSummary {
  const { provider, longTtl, now } = options;
  const usages = turns.map((t) => t.usage);
  const readTotal = usages.reduce((sum, u) => sum + (u.read ?? 0), 0);
  const freshTotal = usages.reduce((sum, u) => sum + (u.fresh ?? 0), 0);
  const writeTotal = usages.reduce((sum, u) => sum + (u.write ?? 0), 0);
  const lastTurn = turns.at(-1) ?? null;
  const previous = turns.length > 1 ? turns[turns.length - 2] : null;
  const diagnosis = lastTurn ? diagnose(previous, lastTurn, longTtl) : null;

  let warm: CacheWarmth = { state: "sem-dados" };
  if (lastTurn && lastTurn.usage.read !== null) {
    // Codex e OpenCode não informam a validade do cache: sem TTL conhecido.
    if (provider === "codex" || provider === "opencode") {
      warm = { state: "sem-ttl" };
    } else {
      const remainingMs = lastTurn.at + (longTtl ? CACHE_TTL_MS.long : CACHE_TTL_MS.short) - now;
      warm = remainingMs > 0 ? { state: "quente", remainingMs } : { state: "frio" };
    }
  }

  // Pausas que apagam o cache se repetem: só então vale sugerir o cache de 1 h (e só para Claude, que o expõe).
  const pauses = turns.filter((t, i) => i > 0 && diagnose(turns[i - 1], t, longTtl) === "pausa").length;
  const tip =
    provider === "claude" && !longTtl && pauses >= 2
      ? "Pausas longas estão apagando o cache. Ligue o cache de 1 h em Configurações > Conversa."
      : null;

  return {
    session: aggregateRate(usages),
    readTotal,
    freshTotal,
    writeTotal,
    last: lastTurn ? { rate: hitRate(lastTurn.usage), diagnosis, model: lastTurn.model } : null,
    history: turns.slice(-12).map((t) => hitRate(t.usage)),
    warm,
    tip,
  };
}
