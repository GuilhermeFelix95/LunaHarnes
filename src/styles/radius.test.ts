import { describe, expect, it } from "vitest";
import { SHAPES } from "../theme";

// Node não tem tipos neste projeto: o módulo entra por nome em variável, sem resolver tipo no tsc.
const FS = "node:fs";
const URL_MODULE = "node:url";
const { readFileSync } = await import(/* @vite-ignore */ FS);
const { fileURLToPath } = await import(/* @vite-ignore */ URL_MODULE);
const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

const tokensCss = read("./tokens.css");
const componentsCss = read("./components.css");

/// Áreas grandes (textarea, cartões de configuração) não podem herdar o raio de controles.
/// No formato Pílula, --radius-md vale 999px e deformava o textarea de Regras globais.
describe("raio de campos e áreas grandes", () => {
  it("define --radius-field com valor fixo, independente do formato", () => {
    const match = tokensCss.match(/--radius-field:\s*([^;]+);/);

    expect(match).not.toBeNull();
    expect(match?.[1].trim()).toMatch(/^\d+px$/);
    expect(parseInt(match![1], 10)).toBeLessThanOrEqual(16);
  });

  it("o textarea de Regras globais usa --radius-field, não --radius-md", () => {
    const block = componentsCss.match(/\.rules__text\s*\{[^}]*\}/)?.[0] ?? "";

    expect(block).toContain("border-radius: var(--radius-field)");
    expect(block).not.toContain("var(--radius-md)");
  });

  it("os cartões de configuração também usam --radius-field", () => {
    const block = componentsCss.match(/\.settings-card\s*\{[^}]*\}/)?.[0] ?? "";

    expect(block).toContain("border-radius: var(--radius-field)");
  });

  it("o formato Pílula de fato tem raio de 999px em --radius-md (causa do problema)", () => {
    expect(SHAPES.pill.md).toBe("999px");
  });

  /// Chips e fichas usam --chip-radius, que antes não era definido e caía em raio inválido (0).
  it("--chip-radius é definido nos tokens, na raio de pílula", () => {
    const match = tokensCss.match(/--chip-radius:\s*([^;]+);/);

    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe("var(--radius-pill)");
  });
});
