import { describe, expect, it } from "vitest";

// Node não tem tipos neste projeto: o módulo entra por nome em variável, sem resolver tipo no tsc.
const FS = "node:fs";
const URL_MODULE = "node:url";
const { readFileSync } = await import(/* @vite-ignore */ FS);
const { fileURLToPath } = await import(/* @vite-ignore */ URL_MODULE);
const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

const components = read("./components.css");

/** Corpo da primeira regra cujo seletor é exatamente `selector`. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = components.match(new RegExp(`\\n${escaped} \\{([^}]*)\\}`));
  if (!match) throw new Error(`regra ${selector} não encontrada`);
  return match[1];
}

describe("Desempenho: superfícies que ficam sempre na tela", () => {
  // Desfoque sobre área grande é refeito a cada quadro em que o chat por trás muda (durante a resposta).
  it.each([".sidebar", ".side", ".composer", ".profile", ".qpick", ".chat__suggestions button"])(
    "%s não usa desfoque de fundo fixo",
    (selector) => {
      expect(ruleBody(selector)).not.toMatch(/backdrop-filter/);
    },
  );

  // Animar a largura da coluna do chat refaz o layout inteiro a cada quadro.
  it("a coluna do chat no modo navegador não anima a largura", () => {
    expect(ruleBody(".chat--browser .chat__column")).not.toMatch(/transition:\s*width/);
  });
});
