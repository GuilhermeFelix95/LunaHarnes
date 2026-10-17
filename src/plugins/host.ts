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

export interface PluginApi {
  /** Requer permissão `commands`. Nome sem barra: `ola` vira `/ola`. */
  registerCommand(name: string, handler: CommandHandler): void;
  /** Requer permissão `hooks`. Pode devolver um novo texto para enviar. */
  onBeforeSend(hook: BeforeSendHook): void;
  /** Requer permissão `hooks`. Recebe o texto final da resposta. */
  onAfterResponse(hook: AfterResponseHook): void;
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
const PERMISSIONS = ["commands", "hooks"] as const;

export class PluginHost {
  private commands = new Map<string, { pluginId: string; handler: CommandHandler }>();
  private beforeSendHooks: { pluginId: string; hook: BeforeSendHook }[] = [];
  private afterResponseHooks: { pluginId: string; hook: AfterResponseHook }[] = [];
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
      this.errors.push(`${manifest.id}: ${e instanceof Error ? e.message : String(e)}`);
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
      const result = await entry.handler(match[2] ?? "");
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
        const next = await hook(current);
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
        await hook(text);
      } catch (e) {
        this.errors.push(`${pluginId} (depois da resposta): ${errorMessage(e)}`);
      }
    }
  }

  commandNames(): string[] {
    return [...this.commands.keys()].sort();
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
    };
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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
