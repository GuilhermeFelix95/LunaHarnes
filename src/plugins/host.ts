// Host de plugins. Cada plugin exporta `activate(api)` e recebe só as APIs
// liberadas no manifesto. Permissão recusada vira erro registrado, não quebra os outros plugins.

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  entry: string;
  permissions: string[];
}

export type CommandHandler = (args: string) => string | void | Promise<string | void>;
export type BeforeSendHook = (prompt: string) => string | void | Promise<string | void>;
export type AfterResponseHook = (text: string) => void | Promise<void>;

/// Tempo máximo de um comando ou hook. Passou disso, o resultado é ignorado e o erro fica registrado.
export const PLUGIN_TIMEOUT_MS = 10_000;

/// Modo que o plugin oferece no composer. Ligado, ele acrescenta `instruction` ao pedido e força a leitura.
export interface PluginMode {
  id: string;
  label: string;
  description: string;
  instruction: string;
  /** Só `readOnly`: um modo restringe, nunca dá mais permissão do que o composer já tem. */
  permission: "readOnly";
  /** Quando `true`, o modo faz o agente perguntar antes de agir, pelo seletor de perguntas do chat. */
  questions?: boolean;
}

export interface PluginApi {
  /** Requer permissão `commands`. Nome sem barra: `ola` vira `/ola`. */
  registerCommand(name: string, handler: CommandHandler): void;
  /** Requer permissão `hooks`. Pode devolver um novo texto para enviar. */
  onBeforeSend(hook: BeforeSendHook): void;
  /** Requer permissão `hooks`. Recebe o texto final da resposta. */
  onAfterResponse(hook: AfterResponseHook): void;
  /** Requer permissão `modes`. Só aceita modos de somente leitura. */
  registerMode(mode: PluginMode): void;
}

export interface PluginModule {
  activate(api: PluginApi): void | Promise<void>;
}

export interface CommandResult {
  /** `false` quando a entrada não é um comando registrado e deve seguir o fluxo normal. */
  handled: boolean;
  /** Texto a enviar ao provedor. Ausente quando o comando só executa uma ação local. */
  prompt?: string;
}

const COMMAND_NAME = /^[a-z][a-z0-9-]*$/;
const PERMISSIONS = ["commands", "hooks", "modes"] as const;

export class PluginHost {
  private commands = new Map<string, { pluginId: string; handler: CommandHandler }>();
  private beforeSendHooks: { pluginId: string; hook: BeforeSendHook }[] = [];
  private afterResponseHooks: { pluginId: string; hook: AfterResponseHook }[] = [];
  private modes = new Map<string, { pluginId: string; mode: PluginMode }>();
  readonly loaded: string[] = [];
  readonly errors: string[] = [];

  /** Ativa um plugin. Falhas ficam em `errors` e não afetam os demais. */
  async load(manifest: PluginManifest, loadModule: () => Promise<PluginModule>): Promise<boolean> {
    try {
      const module = await loadModule();
      const api = this.createApi(manifest);
      await module.activate(api);
      this.loaded.push(manifest.id);
      return true;
    } catch (e) {
      // Ativação pela metade: o que o plugin já registrou sai junto, para não ficar ativo sem o resto.
      this.forget(manifest.id);
      this.errors.push(`${manifest.id}: ${errorMessage(e)}`);
      return false;
    }
  }

  /** Executa um comando se a entrada começar com `/` e houver um comando registrado. */
  async handleCommand(input: string): Promise<CommandResult> {
    const match = /^\/([a-z][a-z0-9-]*)(?:\s+([\s\S]*))?$/.exec(input.trim());
    if (!match) return { handled: false };

    const entry = this.commands.get(match[1]);
    if (!entry) return { handled: false };

    try {
      const result = await withTimeout(entry.handler(match[2] ?? ""), `o comando /${match[1]}`);
      return typeof result === "string" ? { handled: true, prompt: result } : { handled: true };
    } catch (e) {
      this.errors.push(`${entry.pluginId} (/${match[1]}): ${errorMessage(e)}`);
      return { handled: true };
    }
  }

  /** Aplica os hooks em ordem. Um hook que falha é registrado e o texto segue sem ele. */
  async runBeforeSend(prompt: string): Promise<string> {
    let current = prompt;
    for (const { pluginId, hook } of this.beforeSendHooks) {
      try {
        const next = await withTimeout(hook(current), "o hook antes de enviar");
        if (typeof next === "string") current = next;
      } catch (e) {
        this.errors.push(`${pluginId} (antes de enviar): ${errorMessage(e)}`);
      }
    }
    return current;
  }

  async runAfterResponse(text: string): Promise<void> {
    for (const { pluginId, hook } of this.afterResponseHooks) {
      try {
        await withTimeout(hook(text), "o hook depois da resposta");
      } catch (e) {
        this.errors.push(`${pluginId} (depois da resposta): ${errorMessage(e)}`);
      }
    }
  }

  commandNames(): string[] {
    return [...this.commands.keys()].sort();
  }

  /** Modos oferecidos pelos plugins ativos, na ordem em que foram registrados. */
  modeList(): PluginMode[] {
    return [...this.modes.values()].map((entry) => entry.mode);
  }

  /** Tira do host o que um plugin registrou. */
  private forget(pluginId: string) {
    for (const [name, entry] of this.commands) if (entry.pluginId === pluginId) this.commands.delete(name);
    for (const [name, entry] of this.modes) if (entry.pluginId === pluginId) this.modes.delete(name);
    this.beforeSendHooks = this.beforeSendHooks.filter((h) => h.pluginId !== pluginId);
    this.afterResponseHooks = this.afterResponseHooks.filter((h) => h.pluginId !== pluginId);
  }

  /** Esvazia tudo, para recarregar os plugins depois de instalar, desinstalar ou ligar/desligar um. */
  reset() {
    this.commands.clear();
    this.beforeSendHooks = [];
    this.afterResponseHooks = [];
    this.modes.clear();
    this.loaded.length = 0;
    this.errors.length = 0;
  }

  private createApi(manifest: PluginManifest): PluginApi {
    const { id, permissions } = manifest;
    const require = (permission: (typeof PERMISSIONS)[number]) => {
      if (!permissions.includes(permission)) {
        throw new Error(`plugin ${id} não tem a permissão "${permission}" no manifesto`);
      }
    };

    return {
      registerCommand: (name, handler) => {
        require("commands");
        if (!COMMAND_NAME.test(name)) {
          throw new Error(`nome de comando inválido "${name}": use letras minúsculas, números e hífen`);
        }
        if (this.commands.has(name)) {
          throw new Error(`comando "/${name}" já existe (registrado por ${this.commands.get(name)!.pluginId})`);
        }
        this.commands.set(name, { pluginId: id, handler });
      },
      onBeforeSend: (hook) => {
        require("hooks");
        this.beforeSendHooks.push({ pluginId: id, hook });
      },
      onAfterResponse: (hook) => {
        require("hooks");
        this.afterResponseHooks.push({ pluginId: id, hook });
      },
      registerMode: (mode) => {
        require("modes");
        if (!COMMAND_NAME.test(mode.id)) {
          throw new Error(`id de modo inválido "${mode.id}": use letras minúsculas, números e hífen`);
        }
        if (mode.permission !== "readOnly") {
          throw new Error(`modo "${mode.id}" precisa usar permission "readOnly": um modo só pode restringir`);
        }
        if (!mode.label.trim() || !mode.instruction.trim()) {
          throw new Error(`modo "${mode.id}" precisa de label e instruction`);
        }
        if (this.modes.has(mode.id)) {
          throw new Error(`modo "${mode.id}" já existe (registrado por ${this.modes.get(mode.id)!.pluginId})`);
        }
        this.modes.set(mode.id, { pluginId: id, mode: { ...mode } });
      },
    };
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/// Espera o trabalho do plugin, mas desiste depois de PLUGIN_TIMEOUT_MS para não travar o envio.
function withTimeout<T>(work: T | Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} passou de ${PLUGIN_TIMEOUT_MS / 1000} s e foi ignorado`)),
      PLUGIN_TIMEOUT_MS,
    );
  });
  return Promise.race([Promise.resolve(work), limit]).finally(() => clearTimeout(timer));
}

/// Carrega o código do plugin como módulo ES a partir de um Blob.
/// Exige `script-src blob:` na CSP (ver src-tauri/tauri.conf.json).
export async function importPluginSource(source: string): Promise<PluginModule> {
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    return (await import(/* @vite-ignore */ url)) as PluginModule;
  } finally {
    URL.revokeObjectURL(url);
  }
}
