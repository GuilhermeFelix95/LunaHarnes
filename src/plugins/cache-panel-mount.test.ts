import { afterEach, describe, expect, it } from "vitest";
import { PluginHost, type PluginManifest } from "./host";
// @ts-expect-error -- módulo JS do plugin de exemplo, sem tipos
import * as cacheTokens from "../../plugins-examples/cache-tokens/index.js";

const manifest: PluginManifest = {
  id: "cache-tokens",
  name: "Cache de Tokens",
  version: "1.0.0",
  entry: "index.js",
  permissions: ["cache", "commands", "hooks", "ui"],
};

const painel = () => document.querySelector<HTMLElement>('[data-plugin-slot="sidebar"] > [data-plugin="cache-tokens"]')?.textContent ?? "";

// O MutationObserver do host entrega as mudanças de DOM de forma assíncrona.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function slot(): HTMLElement {
  const el = document.createElement("div");
  el.dataset.pluginSlot = "sidebar";
  document.body.appendChild(el);
  return el;
}

describe("painel de cache na barra lateral: montagem", () => {
  const hosts: PluginHost[] = [];
  const carregar = async (host: PluginHost) => {
    hosts.push(host);
    return host.load(manifest, async () => cacheTokens);
  };

  afterEach(() => {
    for (const host of hosts.splice(0)) host.reset();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("aparece mesmo quando a barra lateral é desenhada depois que o plugin carrega", async () => {
    const host = new PluginHost();
    expect(await carregar(host)).toBe(true);

    slot();
    await tick();

    expect(painel()).toContain("Cache");
  });

  it("volta a aparecer depois de o host ser recarregado com a barra lateral já na tela", async () => {
    const host = new PluginHost();
    slot();
    await carregar(host);
    expect(painel()).toContain("Cache");

    host.reset();
    expect(document.querySelector('div[data-plugin="cache-tokens"]')).toBeNull();
    expect(await carregar(host)).toBe(true);
    await tick();

    expect(painel()).toContain("Cache");
  });

  it("volta a aparecer quando a barra lateral é desmontada e desenhada de novo (novo ponto)", async () => {
    const host = new PluginHost();
    const antigo = slot();
    await carregar(host);
    await tick();
    expect(painel()).toContain("Cache");

    // A barra some (ex.: troca de modo) e volta com um ponto novo na tela.
    antigo.remove();
    slot();
    await tick();

    expect(painel()).toContain("Cache");
  });
});
