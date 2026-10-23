import { describe, expect, it } from "vitest";

// Node não tem tipos neste projeto: o módulo entra por nome em variável, sem resolver tipo no tsc.
const FS = "node:fs";
const URL_MODULE = "node:url";
const { readFileSync } = await import(/* @vite-ignore */ FS);
const { fileURLToPath } = await import(/* @vite-ignore */ URL_MODULE);
const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

const components = read("./components.css");

/// Bloco de estilos do formulário do clonador: os campos seguem o tema, como o campo "Outra" do seletor de perguntas.
function ruleBody(selector: string): string {
  const start = components.indexOf(`${selector} {`);
  expect(start, `regra ${selector} existe`).toBeGreaterThanOrEqual(0);
  return components.slice(start, components.indexOf("}", start));
}

describe("formulário do clonador no chat", () => {
  it("o campo de texto usa as variáveis do tema, como o campo Outra", () => {
    const field = ruleBody(".clone__field input");
    expect(field).toContain("var(--glass-border)");
    expect(field).toContain("var(--radius-md)");
    expect(field).toContain("var(--surface)");
    expect(field).toContain("var(--fg)");
  });

  it("o rótulo fica acima do campo, em coluna", () => {
    const label = ruleBody(".clone__field");
    expect(label).toContain("flex-direction: column");
  });

  it("o formulário e os avisos têm regras próprias", () => {
    expect(components).toContain(".clone-flow__form {");
    expect(components).toContain(".clone__warning,");
    expect(components).toContain(".clone__error {");
  });
});
