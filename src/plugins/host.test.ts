import { describe, expect, it } from "vitest";
import { PluginHost, type PluginManifest, type PluginModule } from "./host";

const manifest = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
  id: "hello",
  name: "Hello",
  version: "0.1.0",
  entry: "index.js",
  permissions: ["commands", "hooks"],
  ...overrides,
});

const plugin = (activate: PluginModule["activate"]) => async () => ({ activate });

describe("PluginHost", () => {
  it("registra comando e executa com os argumentos após a barra", async () => {
    const host = new PluginHost();
    await host.load(
      manifest(),
      plugin((api) => api.registerCommand("ola", (args) => `olá, ${args}`)),
    );

    expect(await host.handleCommand("/ola mundo")).toEqual({ handled: true, prompt: "olá, mundo" });
    expect(host.commandNames()).toEqual(["ola"]);
  });

  it("deixa a entrada seguir o fluxo normal quando não há comando", async () => {
    const host = new PluginHost();
    expect(await host.handleCommand("/desconhecido")).toEqual({ handled: false });
    expect(await host.handleCommand("texto comum")).toEqual({ handled: false });
  });

  it("comando que só executa ação não gera prompt", async () => {
    const host = new PluginHost();
    await host.load(manifest(), plugin((api) => api.registerCommand("limpa", () => undefined)));

    expect(await host.handleCommand("/limpa")).toEqual({ handled: true });
  });

  it("recusa registrar comando sem a permissão commands", async () => {
    const host = new PluginHost();
    const ok = await host.load(
      manifest({ permissions: ["hooks"] }),
      plugin((api) => api.registerCommand("ola", () => "x")),
    );

    expect(ok).toBe(false);
    expect(host.errors[0]).toContain('não tem a permissão "commands"');
    expect(host.commandNames()).toEqual([]);
  });

  it("recusa hooks sem a permissão hooks", async () => {
    const host = new PluginHost();
    const ok = await host.load(
      manifest({ permissions: ["commands"] }),
      plugin((api) => api.onBeforeSend((p) => p)),
    );

    expect(ok).toBe(false);
    expect(host.errors[0]).toContain('não tem a permissão "hooks"');
  });

  it("rejeita nome de comando inválido e comando duplicado", async () => {
    const host = new PluginHost();
    await host.load(
      manifest(),
      plugin((api) => {
        api.registerCommand("ola", () => "a");
        api.registerCommand("Ola", () => "b");
      }),
    );
    expect(host.errors[0]).toContain('nome de comando inválido "Ola"');

    await host.load(manifest({ id: "outro" }), plugin((api) => api.registerCommand("ola", () => "c")));
    expect(host.errors[1]).toContain('comando "/ola" já existe');
  });

  it("encadeia hooks antes de enviar e ignora falha isolada", async () => {
    const host = new PluginHost();
    await host.load(
      manifest(),
      plugin((api) => {
        api.onBeforeSend((p) => `[ctx] ${p}`);
        api.onBeforeSend(() => {
          throw new Error("quebrou");
        });
        api.onBeforeSend((p) => `${p} [fim]`);
      }),
    );

    expect(await host.runBeforeSend("oi")).toBe("[ctx] oi [fim]");
    expect(host.errors).toEqual(["hello (antes de enviar): quebrou"]);
  });

  it("entrega o texto final da resposta aos hooks depois da resposta", async () => {
    const host = new PluginHost();
    const received: string[] = [];
    await host.load(manifest(), plugin((api) => api.onAfterResponse((t) => void received.push(t))));

    await host.runAfterResponse("resposta pronta");

    expect(received).toEqual(["resposta pronta"]);
  });

  it("falha ao carregar o módulo não impede os próximos plugins", async () => {
    const host = new PluginHost();
    const ok = await host.load(manifest({ id: "ruim" }), async () => {
      throw new Error("sintaxe inválida");
    });
    await host.load(manifest({ id: "bom" }), plugin((api) => api.registerCommand("bom", () => "ok")));

    expect(ok).toBe(false);
    expect(host.errors[0]).toBe("ruim: sintaxe inválida");
    expect(host.loaded).toEqual(["bom"]);
  });
});

describe("PluginHost: modos", () => {
  const mode = {
    id: "ask",
    label: "Conversar",
    description: "Só explica",
    instruction: "Só explique.",
    permission: "readOnly" as const,
  };

  it("registra um modo de somente leitura com a permissão modes", async () => {
    const host = new PluginHost();
    const ok = await host.load(manifest({ permissions: ["modes"] }), plugin((api) => api.registerMode(mode)));

    expect(ok).toBe(true);
    expect(host.modeList()).toEqual([mode]);
  });

  it("recusa modo sem a permissão modes", async () => {
    const host = new PluginHost();
    const ok = await host.load(manifest({ permissions: ["commands"] }), plugin((api) => api.registerMode(mode)));

    expect(ok).toBe(false);
    expect(host.errors[0]).toContain('não tem a permissão "modes"');
    expect(host.modeList()).toEqual([]);
  });

  it("nunca aceita modo que dê mais permissão do que o composer tem", async () => {
    const host = new PluginHost();
    const ok = await host.load(
      manifest({ permissions: ["modes"] }),
      plugin((api) => api.registerMode({ ...mode, permission: "fullAccess" as never })),
    );

    expect(ok).toBe(false);
    expect(host.errors[0]).toContain('precisa usar permission "readOnly"');
    expect(host.modeList()).toEqual([]);
  });

  it("rejeita id de modo repetido e reset esvazia modos, comandos e erros", async () => {
    const host = new PluginHost();
    await host.load(
      manifest({ permissions: ["modes", "commands"] }),
      plugin((api) => {
        api.registerMode(mode);
        api.registerMode(mode);
        api.registerCommand("ola", () => "x");
      }),
    );
    expect(host.errors[0]).toContain('modo "ask" já existe');

    host.reset();
    expect(host.modeList()).toEqual([]);
    expect(host.commandNames()).toEqual([]);
    expect(host.errors).toEqual([]);
  });
});
