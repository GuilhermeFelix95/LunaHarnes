import { describe, expect, it } from "vitest";

// Node não tem tipos neste projeto: o módulo entra por nome em variável, sem resolver tipo no tsc.
const FS = "node:fs";
const URL_MODULE = "node:url";
const { readFileSync } = await import(/* @vite-ignore */ FS);
const { fileURLToPath } = await import(/* @vite-ignore */ URL_MODULE);
const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

const css = read("./components.css");

/// Corpo de uma regra, do `{` que segue o seletor até o `}` que fecha.
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

describe("barra do navegador", () => {
  it("os botões de voltar, avançar, recarregar e os da direita não encolhem quando o painel fica estreito", () => {
    expect(blockAfter(".browser__btn {")).toContain("flex: 0 0 auto");
  });
});
