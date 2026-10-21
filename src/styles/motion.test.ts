import { describe, expect, it } from "vitest";

// Node não tem tipos neste projeto: o módulo entra por nome em variável, sem resolver tipo no tsc.
const FS = "node:fs";
const URL_MODULE = "node:url";
const { readFileSync } = await import(/* @vite-ignore */ FS);
const { fileURLToPath } = await import(/* @vite-ignore */ URL_MODULE);
const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

const tokens = read("./tokens.css");
const styles = (["base.css", "components.css", "theme-layers.css"] as const).map((name) => read(`./${name}`)).join("\n");

describe("Movimento do app: durações e curva nos tokens", () => {
  it("as durações base são 200ms no padrão e 140ms nas curtas", () => {
    expect(tokens).toMatch(/--dur:\s*200ms;/);
    expect(tokens).toMatch(/--dur-fast:\s*140ms;/);
  });

  it("a curva de movimento é mais suave (saída desacelerada)", () => {
    expect(tokens).toMatch(/--ease:\s*cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/);
  });

  it("movimento reduzido ainda zera as durações", () => {
    const block = tokens.slice(tokens.indexOf("(prefers-reduced-motion"));
    expect(block).toMatch(/--dur-fast:\s*0ms/);
    expect(block).toMatch(/--dur:\s*0ms/);
  });
});

describe("Movimento do app: nenhuma transição com duração fixa", () => {
  const css = styles.replace(/\r/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
  const transitions: string[] = [];

  let cursor = 0;
  for (;;) {
    const start = css.indexOf("transition", cursor);
    if (start === -1) break;
    const colon = css.indexOf(":", start);
    const end = Math.min(
      ...[css.indexOf(";", start), css.indexOf("}", start)].filter((n) => n !== -1),
    );
    if (colon === -1 || colon > end) {
      // Era uma palavra como "transition-property" em outra posição: segue a busca.
      cursor = start + 1;
      continue;
    }
    transitions.push(css.slice(start, end).trim());
    cursor = end;
  }
  // Só declarações de transição propriamente ditas (transitions/transition-duration).
  const relevant = transitions.filter((t) => /^(transition|transition-duration)\b/.test(t));

  it("encontra declarações de transição para conferir", () => {
    expect(relevant.length).toBeGreaterThan(10);
  });

  it("nenhum valor fixo de duração (ms, décimos ou segundos inteiros) fica em uma transição", () => {
    for (const declaration of relevant) {
      const fixed = (declaration.match(/[\d.]+(?:ms|s)\b/g) ?? []).filter(
        (value) => value !== "0s" && Number.parseFloat(value) !== 0,
      );
      expect(fixed, `transição com duração fixa: ${declaration}`).toEqual([]);
      expect(
        /var\(--dur/.test(declaration) || /transition\s*:\s*none/.test(declaration),
        `transição fora dos tokens: ${declaration}`,
      ).toBe(true);
    }
  });
});
