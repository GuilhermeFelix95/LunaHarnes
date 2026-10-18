/// Cache de prompt de 1 h: a Anthropic mantém o prefixo por 1 h em vez de 5 min. A escrita custa mais, a leitura é barata.
/// Desligado por padrão. Só vale para chave da própria Anthropic (o Rust decide, ver api_profiles::long_cache_env).
export const CACHE_LONG_KEY = "luna.cacheLongTtl";

export function longCacheEnabled(): boolean {
  try {
    return localStorage.getItem(CACHE_LONG_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLongCache(on: boolean) {
  try {
    localStorage.setItem(CACHE_LONG_KEY, on ? "1" : "0");
  } catch {
    // Sem armazenamento, a escolha vale só nesta sessão.
  }
}
