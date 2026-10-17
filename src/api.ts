import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { PluginManifest } from "./plugins/host";
import type { ProviderEvent, ProviderKind } from "./types";

export const PROVIDER_EVENT = "provider-event";

/// Envia o prompt ao CLI escolhido. A saída chega pelos eventos `provider-event`.
export function sendPrompt(provider: ProviderKind, prompt: string): Promise<void> {
  return invoke("send_prompt", { provider, prompt });
}

export function cancelPrompt(): Promise<void> {
  return invoke("cancel_prompt");
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

export function onProviderEvent(
  handler: (event: ProviderEvent) => void,
): Promise<UnlistenFn> {
  return listen<ProviderEvent>(PROVIDER_EVENT, (e) => handler(e.payload));
}
