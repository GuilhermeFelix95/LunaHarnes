/// Idioma padrão dos testes: o app é escrito em pt-BR, então o sistema simulado fala português.
/// Testes que precisam de outro idioma trocam navigator.language ou a escolha salva.
Object.defineProperty(navigator, "language", { value: "pt-BR", configurable: true });
