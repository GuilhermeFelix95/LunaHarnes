import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CacheSummary } from "../chat/promptCache";
import { PluginHost, type PluginManifest } from "./host";
// O plugin de exemplo é um JS fora de src/, sem declaração de tipos: o teste carrega o arquivo real.
// @ts-expect-error -- módulo JS do plugin de exemplo, sem tipos
import * as cacheTokens from "../../plugins-examples/cache-tokens/index.js";

// Mesmas permissões do manifest.json do plugin de exemplo.
const manifest: PluginManifest = {
  id: "cache-tokens",
  name: "Cache de Tokens",
  version: "1.0.0",
  entry: "index.js",
  permissions: ["cache", "commands", "hooks", "ui"],
};

function resumo(over: Partial<CacheSummary> = {}): CacheSummary {
  return {
    session: 0.9,
    readTotal: 900,
    freshTotal: 100,
    writeTotal: 0,
    last: { rate: 0.9, diagnosis: null, model: "claude-opus-5-5" },
    history: [0.9],
    warm: { state: "quente", remainingMs: 245_000 },
    tip: null,
    ...over,
  };
}

async function carregar() {
  const host = new PluginHost();
  const ok = await host.load(manifest, async () => cacheTokens);
  expect(ok).toBe(true);
  return host;
}

// Só o bloco da barra lateral: a folha de estilo do plugin também tem data-plugin, mas fica no head.
const painel = () => document.querySelector<HTMLElement>('[data-plugin-slot="sidebar"] > [data-plugin="cache-tokens"]')?.textContent ?? "";

describe("plugin Cache de Tokens v1.0", () => {
  beforeEach(() => {
    const slot = document.createElement("div");
    slot.dataset.pluginSlot = "sidebar";
    document.body.appendChild(slot);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("antes do primeiro turno medido, diz que aguarda", async () => {
    await carregar();

    expect(painel()).toContain("Aguardando o primeiro turno com medição");
  });

  it("mostra a taxa da sessão, o estado do cache e as três contagens depois de um turno", async () => {
    const host = await carregar();
    host.setCacheSummary(resumo());

    await host.runAfterResponse("resposta");

    expect(painel()).toContain("90%");
    expect(painel()).toContain("quente por 4:05");
    expect(painel()).toContain("do cache");
    expect(painel()).toContain("gravados");
    expect(painel()).toContain("novos");
  });

  it("cache expirado aparece como frio", async () => {
    const host = await carregar();
    host.setCacheSummary(resumo({ warm: { state: "frio" } }));

    await host.runAfterResponse("resposta");

    expect(painel()).toContain("frio");
  });

  it("sem dados do provedor aparece como sem dados, e a taxa como traço, nunca 0%", async () => {
    const host = await carregar();
    host.setCacheSummary(resumo({ session: null, warm: { state: "sem-dados" }, last: null }));

    await host.runAfterResponse("resposta");

    expect(painel()).toContain("sem dados");
    expect(painel()).toContain("—");
    expect(painel()).not.toContain("0%");
  });

  it("mostra o motivo de um acerto baixo no último turno", async () => {
    const host = await carregar();
    host.setCacheSummary(resumo({ last: { rate: 0.1, diagnosis: "pausa", model: "claude-opus-5-5" } }));

    await host.runAfterResponse("resposta");

    expect(painel()).toContain("pausa maior que o tempo de vida do cache");
  });

  it("mostra a dica do núcleo quando ela existe", async () => {
    const host = await carregar();
    host.setCacheSummary(resumo({ tip: "Pausas longas estão apagando o cache. Ligue o cache de 1 h em Configurações > Conversa." }));

    await host.runAfterResponse("resposta");

    expect(painel()).toContain("cache de 1 h");
  });

  it("recolher esconde os detalhes e lembra a escolha", async () => {
    const host = await carregar();
    host.setCacheSummary(resumo());
    await host.runAfterResponse("resposta");

    document.querySelector<HTMLButtonElement>('[data-acao="colapsar"]')!.click();

    expect(painel()).not.toContain("do cache");
    expect(localStorage.getItem("luna.plugin.cache-tokens.colapsado")).toBe("1");
  });

  it("/cache mostra o resumo como aviso local, sem ir ao agente", async () => {
    const host = await carregar();
    host.setCacheSummary(resumo());

    const result = await host.handleCommand("/cache");

    expect(result).toEqual({ handled: true });
    expect(host.messages().join(" ")).toContain("90% da entrada veio do cache");
  });
});
