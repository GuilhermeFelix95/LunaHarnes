import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResponseCache } from "../chat/responseCache";
import { PluginHost, type PluginManifest } from "./host";
// O plugin de exemplo é um JS fora de src/, sem declaração de tipos: o teste carrega o arquivo real.
// @ts-expect-error -- módulo JS do plugin de exemplo, sem tipos
import * as cacheTokens from "../../plugins-examples/cache-tokens/index.js";

// Mesmas permissões do manifest.json do plugin de exemplo.
const manifest: PluginManifest = {
  id: "cache-tokens",
  name: "Cache de Tokens",
  version: "0.2.0",
  entry: "index.js",
  permissions: ["cache", "commands", "hooks", "ui"],
};

async function carregar(cache: ResponseCache) {
  const host = new PluginHost(cache);
  const ok = await host.load(manifest, async () => cacheTokens);
  expect(ok).toBe(true);
  return host;
}

const barra = () => document.querySelector<HTMLElement>('[data-plugin="cache-tokens"]')?.textContent ?? "";

describe("plugin Cache de Tokens", () => {
  beforeEach(() => {
    const slot = document.createElement("div");
    slot.dataset.pluginSlot = "sidebar";
    document.body.appendChild(slot);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("liga o cache ao ser ativado", async () => {
    const cache = new ResponseCache();

    await carregar(cache);

    expect(cache.enabled).toBe(true);
  });

  it("mostra na barra lateral que ainda não há consultas", async () => {
    await carregar(new ResponseCache());

    expect(barra()).toContain("aguardando consultas");
  });

  it("atualiza a barra com a taxa depois de uma resposta", async () => {
    const cache = new ResponseCache();
    const host = await carregar(cache);
    cache.get("pedido");
    cache.set("pedido", "resposta");
    cache.get("pedido");

    await host.runAfterResponse("resposta");

    expect(barra()).toContain("50.0% de acerto (1 de 2)");
    expect(barra()).toContain("1 guardada(s)");
  });

  it("/cache mostra a mesma taxa da barra", async () => {
    const cache = new ResponseCache();
    const host = await carregar(cache);
    cache.get("pedido");
    cache.set("pedido", "resposta");
    cache.get("pedido");

    await host.handleCommand("/cache");

    expect(host.messages()).toContain(
      "Cache de respostas: taxa de acerto 50.0% (1 acerto(s) em 2 consulta(s)), 1 resposta(s) guardada(s).",
    );
  });

  it("/cache-limpar esvazia as respostas mas mantém a taxa da sessão", async () => {
    const cache = new ResponseCache();
    const host = await carregar(cache);
    cache.get("pedido");
    cache.set("pedido", "resposta");
    cache.get("pedido");

    await host.handleCommand("/cache-limpar");

    expect(host.messages()).toContain("Cache de respostas esvaziado.");
    expect(cache.stats()).toEqual({ hits: 1, lookups: 2, stored: 0 });
    expect(barra()).toContain("50.0% de acerto (1 de 2)");
    expect(barra()).toContain("0 guardada(s)");
  });

  it("/cache desligar para de contar consultas", async () => {
    const cache = new ResponseCache();
    const host = await carregar(cache);

    await host.handleCommand("/cache desligar");
    cache.get("pedido");

    expect(cache.enabled).toBe(false);
    expect(cache.stats().lookups).toBe(0);
  });
});
