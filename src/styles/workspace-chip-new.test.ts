import { describe, expect, it } from "vitest";
import { SHAPES } from "../theme";

// Node não tem tipos neste projeto: o módulo entra por nome em variável, sem resolver tipo no tsc.
const FS = "node:fs";
const URL_MODULE = "node:url";
const { readFileSync } = await import(/* @vite-ignore */ FS);
const { fileURLToPath } = await import(/* @vite-ignore */ URL_MODULE);
const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

const componentsCss = read("./components.css");

const ruleOf = (selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return componentsCss.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`))?.[0] ?? "";
};

/// O campo "nova-branch" herdava o input cru: cantos retos e cor fixa, fora do tema.
/// Campo e botão "Criar" precisam usar os tokens do formato e do tema atual.
describe("campo de nova branch segue o tema", () => {
  const field = ruleOf(".workspace-chip__new input");
  const button = ruleOf(".workspace-chip__new button");

  it("os 13 formatos de tema estão cobertos pelo teste", () => {
    expect(Object.keys(SHAPES)).toHaveLength(13);
  });

  it("o campo usa o raio do formato e as cores do tema", () => {
    expect(field).toContain("border-radius: var(--input-radius)");
    expect(field).toContain("background: var(--bg)");
    expect(field).toContain("color: var(--fg)");
  });

  it("o botão Criar usa a cor de destaque do tema", () => {
    expect(button).toContain("background: var(--accent)");
    expect(button).toContain("color: var(--accent-fg)");
  });
});
