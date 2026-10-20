import { describe, expect, it } from "vitest";

// Node não tem tipos neste projeto: o módulo entra por nome em variável, sem resolver tipo no tsc.
const FS = "node:fs";
const URL_MODULE = "node:url";
const { readFileSync } = await import(/* @vite-ignore */ FS);
const { fileURLToPath } = await import(/* @vite-ignore */ URL_MODULE);
const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

const componentsCss = read("../../styles/components.css");
const tokensCss = read("../../styles/tokens.css");

/// Animações de Configurações: a tela entra com fade, e cada troca de seção reexibe o painel com a mesma animação.
describe("animações das Configurações", () => {
  it("a tela de Configurações entra com a animação de entrada", () => {
    const block = componentsCss.match(/\.settings\s*\{[^}]*\}/)?.[0] ?? "";

    expect(block).toContain("animation: settings-enter");
    expect(componentsCss).toContain("@keyframes settings-enter");
  });

  it("o painel da seção tem a animação de entrada, que roda a cada troca", () => {
    const block = componentsCss.match(/\.settings__pane\s*\{[^}]*\}/)?.[0] ?? "";

    expect(block).toContain("animation: settings-pane-in");
    expect(componentsCss).toContain("@keyframes settings-pane-in");
  });

  it("movimento reduzido zera as animações pelo token global", () => {
    expect(tokensCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(tokensCss).toContain("animation-duration: 0.01ms !important");
  });
});
