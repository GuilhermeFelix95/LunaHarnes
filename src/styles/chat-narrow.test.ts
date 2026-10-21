import { describe, expect, it } from "vitest";

// Node não tem tipos neste projeto: o módulo entra por nome em variável, sem resolver tipo no tsc.
const FS = "node:fs";
const URL_MODULE = "node:url";
const { readFileSync } = await import(/* @vite-ignore */ FS);
const { fileURLToPath } = await import(/* @vite-ignore */ URL_MODULE);
const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

const css = read("./components.css");

/// Corpo de uma regra ou bloco, do `{` que segue o seletor até o `}` que fecha.
function blockAfter(marker: string): string {
  const start = css.indexOf(marker);
  if (start < 0) return "";
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  return "";
}

describe("coluna do chat estreita (sidebar do agente)", () => {
  it("a coluna do chat é container, para o composer reagir à largura real", () => {
    expect(blockAfter(".chat__column {")).toContain("container-type: inline-size");
  });

  it("abaixo de 420 px o composer ganha margem lateral e os chips ficam dentro da moldura", () => {
    const container = blockAfter("@container (max-width: 420px)");
    expect(container).not.toBe("");
    expect(container).toMatch(/\.composer \{\s*margin: 0 12px 12px;/);
    expect(container).toMatch(/\.composer__footer \{\s*flex-direction: column;/);
    expect(container).toMatch(/\.composer__selectors \.select-menu__trigger \{\s*max-width: 100%;/);
  });

  it("a entrada do modo navegador dura o dobro do token e some com movimento reduzido", () => {
    expect(blockAfter(".chat--browser .chat__column {")).toContain("calc(var(--dur) * 2.6)");
    expect(blockAfter(".chat--browser .side {")).toContain("calc(var(--dur) * 2.6)");
    // Movimento reduzido zera --dur em tokens.css, então a duração fica em 0.
    expect(read("./tokens.css")).toMatch(/--dur: 0ms;/);
  });
});
