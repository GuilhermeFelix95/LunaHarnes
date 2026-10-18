import { describe, expect, it } from "vitest";
import { shortModelName } from "./models";

describe("shortModelName", () => {
  it("mostra só o nome do modelo, sem o fornecedor", () => {
    expect(shortModelName("nvidia/nemotron-3.5-super-vl:free")).toBe("nemotron-3.5-super-vl:free");
    expect(shortModelName("anthropic/claude-sonnet-5.5")).toBe("claude-sonnet-5.5");
  });

  it("id sem barra fica como está", () => {
    expect(shortModelName("deepseek-flash")).toBe("deepseek-flash");
  });
});
