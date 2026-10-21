import { describe, expect, it } from "vitest";

// Node não tem tipos neste projeto: o módulo entra por nome em variável, sem resolver tipo no tsc.
const FS = "node:fs";
const URL_MODULE = "node:url";
const { readFileSync } = await import(/* @vite-ignore */ FS);
const { fileURLToPath } = await import(/* @vite-ignore */ URL_MODULE);
const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

const css = read("./components.css");

describe("desempenho: desfoque e animações", () => {
  it("áreas grandes não têm desfoque fixo sobre o conteúdo que rola", () => {
    for (const selector of [".sidebar", ".side", ".composer", ".chat__suggestions button", ".profile", ".qpick"]) {
      expect(ruleBody(selector), selector).not.toContain("backdrop-filter");
    }
  });

  it("a largura do chat no modo navegador não é animada", () => {
    expect(ruleBody(".chat--browser .chat__column")).not.toMatch(/transition:[^;]*width/);
  });

  it("as barras de uso e de progresso animam com transform, não com largura", () => {
    expect(ruleBody(".usage__fill")).toMatch(/transition:\s*transform/);
    expect(ruleBody(".timeline__bar > span")).toMatch(/transition:\s*transform/);
  });

  it("o anel do passo em andamento anima só transform e opacidade", () => {
    const start = css.indexOf("@keyframes timeline-ring {");
    const end = css.indexOf("\n}", start);
    expect(css.slice(start, end)).not.toContain("box-shadow");
  });

  it("os movimentos do modo navegador usam os multiplicadores menores", () => {
    expect(ruleBody(".chat--browser .side")).toContain("calc(var(--dur) * 1.5)");
    expect(ruleBody(".mode-warp--in")).toContain("calc(var(--dur) * 2)");
    expect(ruleBody(".mode-warp--out")).toContain("calc(var(--dur) * 2)");
  });
});

/// Corpo de uma regra cujo seletor começa a linha, sem confundir com seletores que o contêm.
function ruleBody(selector: string): string {
  const escaped = selector.replace(/\./g, "\\.");
  const match = new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`).exec(css);
  return match?.[1] ?? "";
}
