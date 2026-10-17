import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { PluginManifest } from "./plugins/host";
import type {
  ChangedFile,
  Changes,
  Conversation,
  ConversationSummary,
  ModelOption,
  ProviderEvent,
  ProviderKind,
  RunRequest,
} from "./types";

export const PROVIDER_EVENT = "provider-event";

/// Envia o prompt ao CLI escolhido. A saída chega pelos eventos `provider-event`.
export function sendPrompt(request: RunRequest): Promise<void> {
  return invoke("send_prompt", { request });
}

export function cancelPrompt(): Promise<void> {
  return invoke("cancel_prompt");
}

export function onProviderEvent(
  handler: (event: ProviderEvent) => void,
): Promise<UnlistenFn> {
  return listen<ProviderEvent>(PROVIDER_EVENT, (e) => handler(e.payload));
}

export interface PluginScan {
  plugins: PluginManifest[];
  errors: { folder: string; message: string }[];
}

export function listPlugins(): Promise<PluginScan> {
  return invoke("list_plugins");
}

export function readPluginEntry(id: string): Promise<string> {
  return invoke("read_plugin_entry", { id });
}

/// Modelos e níveis de esforço que a CLI do provedor aceita.
export function listModels(provider: ProviderKind): Promise<ModelOption[]> {
  return invoke("list_models", { provider });
}

/// `true` quando o CLI do provedor já tem uma conta conectada.
export function checkAuth(provider: ProviderKind): Promise<boolean> {
  return invoke("check_auth", { provider });
}

/// Abre a janela de login oficial do CLI (interativa, no navegador).
export function openLogin(provider: ProviderKind): Promise<void> {
  return invoke("open_login", { provider });
}

export function listConversations(): Promise<ConversationSummary[]> {
  return invoke("list_conversations");
}

export function loadConversation(id: string): Promise<Conversation> {
  return invoke("load_conversation", { id });
}

export function saveConversation(conversation: Conversation): Promise<void> {
  return invoke("save_conversation", { conversation });
}

export function deleteConversation(id: string): Promise<void> {
  return invoke("delete_conversation", { id });
}

/// Pasta de onde o `luna` foi rodado; é o ponto de partida do workspace.
export function getWorkspace(): Promise<string> {
  return invoke("get_workspace");
}

/// Abre o seletor de pastas do sistema. `null` quando o usuário cancela.
export async function pickWorkspace(current?: string): Promise<string | null> {
  const picked = await open({ directory: true, multiple: false, defaultPath: current || undefined });
  return typeof picked === "string" ? picked : null;
}

/// Arquivos alterados na pasta de trabalho, pelo git.
export function getChanges(cwd: string): Promise<Changes> {
  return invoke("get_changes", { cwd });
}

/// Diff de um arquivo alterado.
export function getFileDiff(cwd: string, path: ChangedFile["path"]): Promise<string> {
  return invoke("get_file_diff", { cwd, path });
}

/// Abre um shell na pasta dada e devolve o id para escrever, redimensionar e fechar.
export function terminalOpen(cwd: string, cols: number, rows: number): Promise<string> {
  return invoke("terminal_open", { cwd, cols, rows });
}

export function terminalWrite(id: string, data: string): Promise<void> {
  return invoke("terminal_write", { id, data });
}

export function terminalResize(id: string, cols: number, rows: number): Promise<void> {
  return invoke("terminal_resize", { id, cols, rows });
}

export function terminalClose(id: string): Promise<void> {
  return invoke("terminal_close", { id });
}

export interface TerminalDataEvent {
  id: string;
  data: string;
}

/// Saída de um terminal. Cada handler filtra pelo próprio id.
export function onTerminalData(handler: (event: TerminalDataEvent) => void): Promise<UnlistenFn> {
  return listen<TerminalDataEvent>("terminal-data", (e) => handler(e.payload));
}

export function onTerminalExit(handler: (id: string) => void): Promise<UnlistenFn> {
  return listen<{ id: string }>("terminal-exit", (e) => handler(e.payload.id));
}
