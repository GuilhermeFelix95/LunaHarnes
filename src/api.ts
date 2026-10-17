import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { PluginManifest } from "./plugins/host";
import type { ProviderEvent, ProviderKind, RunRequest } from "./types";

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

/// `true` quando o CLI do provedor já tem uma conta conectada.
export function checkAuth(provider: ProviderKind): Promise<boolean> {
  return invoke("check_auth", { provider });
}

/// Abre a janela de login oficial do CLI (interativa, no navegador).
export function openLogin(provider: ProviderKind): Promise<void> {
  return invoke("open_login", { provider });
}

/// Pasta de onde o `luna` foi rodado; é o ponto de partida do workspace.
export function getWorkspace(): Promise<string> {
  return invoke("get_workspace");
}

/// Abre o seletor de pastas do sistema. `null` quando o usuário cancela.
export async function pickWorkspace(current: string): Promise<string | null> {
  const picked = await open({ directory: true, multiple: false, defaultPath: current });
  return typeof picked === "string" ? picked : null;
}
