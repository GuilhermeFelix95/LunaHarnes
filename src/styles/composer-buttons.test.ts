import { describe, expect, it } from "vitest";

// Node não tem tipos neste projeto: o módulo entra por nome em variável, sem resolver tipo no tsc.
const FS = "node:fs";
const URL_MODULE = "node:url";
const { readFileSync } = await import(/* @vite-ignore */ FS);
const { fileURLToPath } = await import(/* @vite-ignore */ URL_MODULE);
const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

const components = read("./components.css");

/// Os botões de ação do composer (Meta, Plano e Clonar site) dividem o mesmo visual.
describe("botões do composer", () => {
  it("Clonar site usa o mesmo estilo base e de hover de Meta e Plano", () => {
    const baseStart = components.indexOf(".composer__plan,");
    const base = components.slice(baseStart, components.indexOf("{", baseStart));
    const hoverStart = components.indexOf(".composer__plan:hover");
    const hover = components.slice(hoverStart, components.indexOf("{", hoverStart));

    expect(base).toContain(".composer__clone");
    expect(base).toContain(".composer__goal");
    expect(hover).toContain(".composer__clone:hover:not(:disabled)");
  });
});
