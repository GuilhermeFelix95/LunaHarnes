import { describe, expect, it } from "vitest";
import { profileModelOptions, shortModelName } from "./models";

const profile = {
  id: "p1",
  name: "OpenRouter",
  preset: "openRouter",
  baseUrl: "",
  models: ["nvidia/nemotron-3.5-super-vl:free", "anthropic/claude-sonnet-5.5", "outro/pago"],
  defaultModel: "outro/pago",
};

describe("profileModelOptions", () => {
  it("mostra todos os modelos por padrão, com nome curto e janela de contexto", () => {
    const options = profileModelOptions({ ...profile, contextWindows: { "outro/pago": 128000 } });

    expect(options.map((o) => o.label)).toEqual(["nemotron-3.5-super-vl:free", "claude-sonnet-5.5", "pago"]);
    expect(options.find((o) => o.id === "outro/pago")).toMatchObject({ default: true, contextWindow: 128000 });
  });

  it("escopo só gratuitos esconde os pagos", () => {
    const options = profileModelOptions({ ...profile, modelScope: "free" });

    expect(options.map((o) => o.id)).toEqual(["nvidia/nemotron-3.5-super-vl:free"]);
  });
});

describe("shortModelName", () => {
  it("mostra só o nome do modelo, sem o fornecedor", () => {
    expect(shortModelName("nvidia/nemotron-3.5-super-vl:free")).toBe("nemotron-3.5-super-vl:free");
    expect(shortModelName("anthropic/claude-sonnet-5.5")).toBe("claude-sonnet-5.5");
  });

  it("id sem barra fica como está", () => {
    expect(shortModelName("deepseek-flash")).toBe("deepseek-flash");
  });
});
