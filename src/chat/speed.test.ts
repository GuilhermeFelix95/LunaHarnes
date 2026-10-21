import { describe, expect, it } from "vitest";
import { estimateTokensPerSecond } from "./speed";

describe("velocidade da resposta", () => {
  it("estima tokens por segundo a partir dos caracteres recebidos (≈4 por token)", () => {
    // 400 caracteres = 100 tokens estimados em 2 s = 50 tokens/s
    expect(estimateTokensPerSecond(400, 2000)).toBe(50);
  });

  it("sem tempo decorrido ainda não há taxa", () => {
    expect(estimateTokensPerSecond(400, 0)).toBeNull();
  });

  it("sem caracteres recebidos a taxa é zero", () => {
    expect(estimateTokensPerSecond(0, 1500)).toBe(0);
  });
});
