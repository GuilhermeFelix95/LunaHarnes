// Cache de respostas em memória, compartilhado por todas as conversas abertas na sessão.
// Só o núcleo guarda respostas; o plugin de cache liga e desliga e pede esvaziar ou estatísticas.

export interface CacheStats {
  /** Pedidos atendidos pelo cache (envios que não foram ao provedor). */
  hits: number;
  /** Respostas guardadas agora. */
  stored: number;
}

/// Tudo que torna um pedido "o mesmo": se algum campo muda, o pedido vai ao provedor.
export interface CacheKeyParts {
  cwd: string;
  provider: string;
  profile: string;
  model: string;
  effort: string;
  permission: string;
  mode: string;
  text: string;
}

export function cacheKey(parts: CacheKeyParts): string {
  return JSON.stringify(parts);
}

export class ResponseCache {
  enabled = false;
  private entries = new Map<string, string>();
  private hits = 0;

  setEnabled(on: boolean) {
    this.enabled = on;
  }

  get(key: string): string | undefined {
    if (!this.enabled) return undefined;
    const text = this.entries.get(key);
    if (text !== undefined) this.hits++;
    return text;
  }

  /** Guarda só com o cache ligado; desligado, a resposta não fica guardada. */
  set(key: string, text: string) {
    if (this.enabled) this.entries.set(key, text);
  }

  clear() {
    this.entries.clear();
  }

  stats(): CacheStats {
    return { hits: this.hits, stored: this.entries.size };
  }
}

export const responseCache = new ResponseCache();
