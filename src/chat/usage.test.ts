import { describe, expect, it } from "vitest";
import { contextPercent, formatReset, formatTokens, utilizationPercent } from "./usage";

describe("usage", () => {
  it("formata tokens em k e M, como os provedores", () => {
    expect(formatTokens(44060)).toBe("44k");
    expect(formatTokens(1_000_000)).toBe("1M");
    expect(formatTokens(1_200_000)).toBe("1,2M");
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(850)).toBe("850");
  });

  it("calcula a porcentagem do contexto sem passar de 100", () => {
    expect(contextPercent(44060, 1_000_000)).toBe(4);
    expect(contextPercent(2_000_000, 1_000_000)).toBe(100);
    expect(contextPercent(10, 0)).toBe(0);
  });

  it("converte a fração da CLI em porcentagem", () => {
    expect(utilizationPercent(0.45)).toBe(45);
    expect(utilizationPercent(0.35)).toBe(35);
    expect(utilizationPercent(1.4)).toBe(100);
  });

  it("horário de reset: a janela de 5 horas mostra só a hora", () => {
    // O horário depende do fuso do computador, então o teste confere só o formato HH:MM.
    const text = formatReset(1792266000, "fiveHour", "pt-BR");
    expect(text).toMatch(/^\d{2}:\d{2}$/);
  });

  it("horário de reset semanal traz o dia da semana", () => {
    const text = formatReset(1792512000, "sevenDay", "pt-BR");
    expect(text).toMatch(/\d{2}:\d{2}/);
    expect(text.length).toBeGreaterThan(5);
  });
});
