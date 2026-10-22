import { describe, expect, it } from "vitest";

// Node não tem tipos neste projeto: o módulo entra por nome em variável, sem resolver tipo no tsc.
const FS = "node:fs";
const URL_MODULE = "node:url";
const { readFileSync } = await import(/* @vite-ignore */ FS);
const { fileURLToPath } = await import(/* @vite-ignore */ URL_MODULE);
const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");
const components = read("./components.css");

describe("lista de branches do menu", () => {
  it("tem altura limitada e rolagem vertical, para o resto aparecer com o scroll", () => {
    const start = components.indexOf(".workspace-chip__branches {");
    expect(start).toBeGreaterThan(-1);
    const body = components.slice(start, components.indexOf("}", start));
    expect(body).toMatch(/max-height:\s*256px/);
    expect(body).toMatch(/overflow-y:\s*auto/);
  });
});
