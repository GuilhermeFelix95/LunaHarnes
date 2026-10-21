import { describe, expect, it } from "vitest";

// Node não tem tipos neste projeto: o módulo entra por nome em variável, sem resolver tipo no tsc.
const FS = "node:fs";
const URL_MODULE = "node:url";
const { readFileSync } = await import(/* @vite-ignore */ FS);
const { fileURLToPath } = await import(/* @vite-ignore */ URL_MODULE);
const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

const components = read("./components.css");

/** Corpo da primeira regra cuja lista de seletores contém `selector` (regras agrupadas contam). */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = components.match(new RegExp(`(?:^|\\n)[^{}]*${escaped}[^{}]* \\{([^}]*)\\}`));
  if (!match) throw new Error(`regra ${selector} não encontrada`);
  return match[1];
}

describe("Botão /meta do composer: mesmo estilo do Planejar", () => {
  it("o botão tem pílula com a mesma aparência do Planejar", () => {
    expect(ruleBody(".composer__goal")).toMatch(/border-radius:\s*var\(--radius-pill\)/);
  });

  it("ligado, o botão ganha o acento do tema, como o Planejar", () => {
    expect(ruleBody('.composer__goal[aria-pressed="true"]')).toMatch(/background:\s*var\(--accent\)/);
  });
});
