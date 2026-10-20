import { describe, expect, it } from "vitest";
import { SHAPES } from "../theme";

// Node não tem tipos neste projeto: o módulo entra por nome em variável, sem resolver tipo no tsc.
const FS = "node:fs";
const URL_MODULE = "node:url";
const { readFileSync } = await import(/* @vite-ignore */ FS);
const { fileURLToPath } = await import(/* @vite-ignore */ URL_MODULE);
const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

const componentsCss = read("./components.css");

const ruleOf = (selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return componentsCss.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`))?.[0] ?? "";
};

/// O campo de mensagem herdava o raio do formato sem espaço interno, e as bordas cortavam o texto.
/// Nos formatos com raio alto (Pílula, Bolha, Gota...), o textarea precisa de teto de raio e de padding.
describe("campo de mensagem do composer nos formatos de tema", () => {
  const textarea = ruleOf(".composer textarea");

  it("os 13 formatos de tema estão cobertos pelo teste", () => {
    expect(Object.keys(SHAPES)).toHaveLength(13);
  });

  it.each(Object.keys(SHAPES))("formato %s: raio do campo tem teto de 12px", () => {
    expect(textarea).toContain("border-radius: min(var(--input-radius), 12px)");
  });

  it("tem padding horizontal, para o texto não encostar na borda", () => {
    const padding = textarea.match(/padding:\s*([^;]+);/)?.[1].trim().split(/\s+/) ?? [];
    const horizontal = padding.length >= 2 ? padding[1] : padding[0];

    expect(horizontal).toMatch(/^\d+px$/);
    expect(parseInt(horizontal, 10)).toBeGreaterThan(0);
  });

  it("quebra linha só entre palavras, sem quebrar palavra no meio", () => {
    expect(textarea).toContain("overflow-wrap: normal");
    expect(textarea).toContain("word-break: normal");
  });

  it("a moldura do composer continua usando o raio do formato", () => {
    expect(ruleOf(".composer")).toContain("border-radius: var(--composer-radius)");
  });
});
