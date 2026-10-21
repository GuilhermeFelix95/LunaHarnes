import type { SearchEngine } from "../types";

const KEY = "luna.searchEngine";
export const DEFAULT_ENGINE: SearchEngine = "google";

/// Pedaço do endereço de busca: o texto digitado entra no lugar de {q}.
const TEMPLATES: Record<SearchEngine, string> = {
  google: "https://www.google.com/search?q={q}",
  duckduckgo: "https://duckduckgo.com/?q={q}",
  bing: "https://www.bing.com/search?q={q}",
  brave: "https://search.brave.com/search?q={q}",
};

/// Motor de busca da barra de endereço, escolhido em Configurações. Padrão: o Google.
export function getSearchEngine(): SearchEngine {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && saved in TEMPLATES) return saved as SearchEngine;
  } catch {
    // Armazenamento indisponível: fica no padrão.
  }
  return DEFAULT_ENGINE;
}

export function setSearchEngine(engine: SearchEngine) {
  try {
    localStorage.setItem(KEY, engine);
  } catch {
    // Sem armazenamento (janela privada, dados bloqueados): a escolha vale só até fechar o app.
  }
}

/// Monta o endereço de busca no motor escolhido.
export function buildSearchUrl(engine: SearchEngine, query: string): string {
  return TEMPLATES[engine].replace("{q}", encodeURIComponent(query.trim()));
}

/// Parece um endereço Web: tem um esquema colado ao começo (https://, file://…) ou é
/// um domínio com ponto e sem espaço no meio. Tudo o que não casa vira busca.
export function isLikelyAddress(text: string): boolean {
  const value = text.trim();
  if (!value || /\s/.test(value)) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) return true;
  return /^[^/:?#\s]+\.[^/:?#\s]+/.test(value);
}
