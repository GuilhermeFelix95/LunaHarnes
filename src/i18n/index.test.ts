import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LANGUAGE_KEY, detectSystemLocale, getLanguageChoice, resolveLocale, setLanguageChoice, t } from "./index";

function setSystemLanguage(language: string) {
  Object.defineProperty(navigator, "language", { value: language, configurable: true });
}

describe("i18n", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    setSystemLanguage("pt-BR");
  });

  it("usa inglês quando o idioma do sistema não é suportado", () => {
    setSystemLanguage("fr-FR");

    expect(detectSystemLocale()).toBe("en");
    expect(resolveLocale()).toBe("en");
  });

  it("detecta qualquer português do sistema como pt-BR", () => {
    setSystemLanguage("pt-PT");
    expect(detectSystemLocale()).toBe("pt-BR");

    setSystemLanguage("pt");
    expect(detectSystemLocale()).toBe("pt-BR");
  });

  it("detecta inglês em qualquer região", () => {
    setSystemLanguage("en-GB");
    expect(detectSystemLocale()).toBe("en");
  });

  it("o padrão é Sistema, sem nada salvo", () => {
    expect(getLanguageChoice()).toBe("system");
    expect(localStorage.getItem(LANGUAGE_KEY)).toBeNull();
  });

  it("a escolha salva prevalece sobre o idioma do sistema", () => {
    setSystemLanguage("pt-BR");
    setLanguageChoice("en");

    expect(localStorage.getItem(LANGUAGE_KEY)).toBe("en");
    expect(resolveLocale()).toBe("en");
  });

  it("voltar para Sistema remove a escolha e segue o idioma do sistema", () => {
    setLanguageChoice("en");
    setLanguageChoice("system");

    expect(localStorage.getItem(LANGUAGE_KEY)).toBeNull();
    setSystemLanguage("pt-BR");
    expect(resolveLocale()).toBe("pt-BR");
  });

  it("valor salvo inválido volta para Sistema", () => {
    localStorage.setItem(LANGUAGE_KEY, "klingon");

    expect(getLanguageChoice()).toBe("system");
  });

  it("t() traduz pelo idioma escolhido e preenche as variáveis", () => {
    setLanguageChoice("pt-BR");
    expect(t("common.itemCount", { count: 3 })).toBe("3 itens");

    setLanguageChoice("en");
    expect(t("common.itemCount", { count: 3 })).toBe("3 items");
  });
});
