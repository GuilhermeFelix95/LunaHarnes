// Tipos da API de plugins do LunaHarness. Use para ter autocompletar no index.js:
// no topo do arquivo, escreva  /// <reference path="../luna-plugin.d.ts" />
// Guia completo em docs/plugins.md.

/** Modo do composer. Só `readOnly`: um modo restringe, nunca amplia permissão. */
export interface PluginMode {
  id: string;
  label: string;
  description: string;
  instruction: string;
  permission: "readOnly";
  /** `true` faz o agente perguntar antes de agir, pelo seletor de perguntas do chat. */
  questions?: boolean;
}

/** Cache de respostas da sessão. Requer `cache`. Começa desligado. */
export interface PluginCacheApi {
  setEnabled(enabled: boolean): void;
  clear(): void;
  stats(): { hits: number; stored: number };
  /** Aviso local no chat. Não é enviado ao agente. */
  notify(text: string): void;
}

export interface LunaPluginApi {
  /** Requer `commands`. O nome vira `/nome` no chat. Devolver texto envia esse texto como pedido. */
  registerCommand(name: string, handler: (args: string) => string | void | Promise<string | void>): void;
  /** Requer `hooks`. Recebe o texto antes do envio e pode devolver outro texto. */
  onBeforeSend(hook: (prompt: string) => string | void | Promise<string | void>): void;
  /** Requer `hooks`. Recebe o texto completo da resposta. Não altera a resposta exibida. */
  onAfterResponse(hook: (text: string) => void | Promise<void>): void;
  /** Requer `modes`. */
  registerMode(mode: PluginMode): void;
  /** Requer `cache`. Sem essa permissão, acessar `cache` recusa o plugin. */
  readonly cache: PluginCacheApi;
}

/** Todo plugin exporta `activate`, chamado uma vez quando o plugin é ligado ou o app abre. */
export declare function activate(api: LunaPluginApi): void | Promise<void>;
