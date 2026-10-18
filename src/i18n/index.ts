import { useSyncExternalStore } from "react";
import { en } from "./en";
import { ptBR, type MessageKey } from "./ptBR";

export type { MessageKey };

/// Idioma da interface. A escolha do usuário fica salva no localStorage; "system" segue o
/// idioma do sistema (navigator.language). Idioma do sistema sem tradução cai no inglês.
export type LanguageChoice = "system" | "pt-BR" | "en";
export type Locale = "pt-BR" | "en";

export const LANGUAGE_KEY = "luna.language";
export const LANGUAGE_CHANGED = "luna:language-changed";

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { "pt-BR": ptBR, en };

export function detectSystemLocale(): Locale {
  const language = navigator.language ?? "";
  return language.toLowerCase().split("-")[0] === "pt" ? "pt-BR" : "en";
}

export function getLanguageChoice(): LanguageChoice {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  return saved === "pt-BR" || saved === "en" ? saved : "system";
}

export function setLanguageChoice(choice: LanguageChoice) {
  if (choice === "system") localStorage.removeItem(LANGUAGE_KEY);
  else localStorage.setItem(LANGUAGE_KEY, choice);
  window.dispatchEvent(new Event(LANGUAGE_CHANGED));
}

export function resolveLocale(): Locale {
  const choice = getLanguageChoice();
  return choice === "system" ? detectSystemLocale() : choice;
}

/// Traduz a chave pelo idioma atual. Variáveis entram no lugar de {nome}.
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const text = DICTIONARIES[resolveLocale()][key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => String(vars[name] ?? match));
}

function subscribe(listener: () => void) {
  window.addEventListener(LANGUAGE_CHANGED, listener);
  return () => window.removeEventListener(LANGUAGE_CHANGED, listener);
}

/// Componentes que usam este hook são refeitos quando o idioma muda.
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, resolveLocale);
}
