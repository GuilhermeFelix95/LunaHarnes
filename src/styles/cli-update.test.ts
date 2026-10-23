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

describe("faixa de atualização das CLIs, acima do composer", () => {
  it("tem a mesma largura do cartão do plugin, centralizada e sem estourar a coluna", () => {
    const box = blockAfter(".cli-update {");
    expect(box).toMatch(/max-width: 760px;/);
    expect(box).toMatch(/width: 100%;/);
    expect(box).toMatch(/box-sizing: border-box;/);
  });

  it("cada CLI é uma linha: texto à esquerda e botão Atualizar à direita", () => {
    const row = blockAfter(".cli-update__row {");
    expect(row).toMatch(/display: flex;/);
    expect(row).toMatch(/justify-content: space-between;/);
  });

  it("o texto quebra linha em vez de correr para fora da faixa", () => {
    const text = blockAfter(".cli-update__row span {");
    expect(text).toMatch(/min-width: 0;/);
    expect(text).toMatch(/overflow-wrap: anywhere;/);
  });

  it("a falha da atualização aparece em cor de erro", () => {
    expect(blockAfter(".cli-update__error {")).toMatch(/color: var\(--error\);/);
  });
});

describe("página Sobre", () => {
  it("as notas da versão têm altura máxima com rolagem e quebram linha", () => {
    const notes = blockAfter(".about__notes {");
    expect(notes).toMatch(/max-height: 240px;/);
    expect(notes).toMatch(/overflow: auto;/);
    expect(notes).toMatch(/white-space: pre-wrap;/);
  });
});
