import { beforeEach, describe, expect, it } from "vitest";
import { getAgentBrowser, setAgentBrowser } from "./agentBrowser";

describe("navegador do agente", () => {
  beforeEach(() => localStorage.clear());

  it("sem escolha salva, usa o navegador embutido", () => {
    expect(getAgentBrowser()).toBe("builtin");
  });

  it("guarda e lê a escolha do Playwright", () => {
    setAgentBrowser("playwright");

    expect(getAgentBrowser()).toBe("playwright");
  });

  it("valor salvo inválido volta para o embutido", () => {
    localStorage.setItem("luna.agentBrowser", "firefox");

    expect(getAgentBrowser()).toBe("builtin");
  });
});
