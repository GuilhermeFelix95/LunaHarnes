import { describe, expect, it } from "vitest";

// Node não tem tipos neste projeto: o módulo entra por nome em variável, sem resolver tipo no tsc.
const FS = "node:fs";
const URL_MODULE = "node:url";
const { readFileSync } = await import(/* @vite-ignore */ FS);
const { fileURLToPath } = await import(/* @vite-ignore */ URL_MODULE);
const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

const components = read("./components.css");

/// Corpo de uma regra pelo seletor exato, como o restante dos testes de estilo do projeto.
function ruleBody(selector: string): string {
  const start = components.indexOf(`${selector} {`);
  expect(start, `regra ${selector} existe`).toBeGreaterThanOrEqual(0);
  return components.slice(start, components.indexOf("}", start));
}

describe("rodapé do modo navegador", () => {
  it("o rodapé do chat fica menor que o do LunaCode", () => {
    expect(ruleBody(".chat--browser .chat__foot")).toContain("font-size: 11px;");
  });

  it("os seletores vazios do composer não ocupam espaço no modo navegador", () => {
    expect(ruleBody(".chat--browser .composer__selectors:empty")).toContain("display: none;");
  });
});
