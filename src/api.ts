import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { PluginManifest } from "./plugins/host";
import type { SlashItem } from "./chat/slash";
import type {
  ApiPreset,
  ApiProfile,
  ChangedFile,
  Changes,
  CliStatus,
  Conversation,
  ConversationSummary,
  ModelOption,
  ProviderEvent,
  ProviderKind,
  RemoteModels,
  RunRequest,
} from "./types";

export const PROVIDER_EVENT = "provider-event";

/// Envia o prompt ao CLI escolhido. A saída chega pelos eventos `provider-event`.
/// `runId` é o id da conversa: cada conversa tem a sua execução, e várias rodam ao mesmo tempo.
export function sendPrompt(request: RunRequest, runId: string): Promise<void> {
  return invoke("send_prompt", { request, runId });
}

export function cancelPrompt(runId: string): Promise<void> {
  return invoke("cancel_prompt", { runId });
}

/// Entrega só os eventos da execução `runId`.
export function onProviderEvent(
  runId: string,
  handler: (event: ProviderEvent) => void,
): Promise<UnlistenFn> {
  return listen<{ runId: string; event: ProviderEvent }>(PROVIDER_EVENT, (e) => {
    if (e.payload.runId === runId) handler(e.payload.event);
  });
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

export function renameConversation(id: string, title: string): Promise<void> {
  return invoke("rename_conversation", { id, title });
}

/// Situação das CLIs (Claude Code e Codex) no computador.
export function cliStatus(): Promise<CliStatus[]> {
  return invoke("cli_status");
}

/// Roda o instalador oficial da CLI. Só instala se ela ainda não estiver no computador.
export function installCli(kind: ProviderKind): Promise<CliStatus> {
  return invoke("install_cli", { kind });
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

/// Salva uma imagem anexada (base64) na pasta de anexos do app e devolve o caminho.
export function saveAttachment(name: string, data: string): Promise<string> {
  return invoke("save_attachment", { name, data });
}

/// Arquivos do projeto para o @arquivo, filtrados pelo trecho digitado (até 50).
export function listFiles(cwd: string, query: string): Promise<string[]> {
  return invoke("list_files", { cwd, query });
}

/// Skills e comandos que a CLI conhece, para o menu de `/`. Lê as pastas do usuário e, no Claude, a do projeto.
export async function listSlashItems(cwd: string, provider: ProviderKind): Promise<SlashItem[]> {
  const items = await invoke<{ name: string; description: string; kind: "skill" | "command" }[]>("list_slash_items", {
    cwd,
    provider,
  });
  return items.map((item) => ({ name: item.name, description: item.description, origin: item.kind }));
}

/// Grava o estado dos arquivos antes de um turno. `null` fora de repositório git.
export function checkpointTake(cwd: string): Promise<string | null> {
  return invoke("checkpoint_take", { cwd });
}

export interface RestorePreview {
  /** Arquivos criados depois do checkpoint: serão apagados. */
  removed: string[];
  /** Arquivos alterados ou removidos depois: voltam ao que eram. */
  restored: string[];
}

export function checkpointPreview(cwd: string, checkpoint: string): Promise<RestorePreview> {
  return invoke("checkpoint_preview", { cwd, checkpoint });
}

export function checkpointRestore(cwd: string, checkpoint: string): Promise<RestorePreview> {
  return invoke("checkpoint_restore", { cwd, checkpoint });
}

/// Desfaz a alteração de um arquivo: volta ao HEAD, ou apaga o que nunca foi commitado.
export function discardChange(cwd: string, path: string, status: ChangedFile["status"]): Promise<void> {
  return invoke("discard_change", { cwd, path, status });
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

/// Provedores prontos para criar um perfil de API.
export function apiPresets(): Promise<ApiPreset[]> {
  return invoke("api_presets");
}

export function listApiProfiles(): Promise<ApiProfile[]> {
  return invoke("list_api_profiles");
}

/// Salva o perfil sem a chave e devolve o perfil com o id definido.
export function saveApiProfile(profile: Omit<ApiProfile, "id"> & { id?: string }): Promise<ApiProfile> {
  return invoke("save_api_profile", { profile: { id: "", ...profile } });
}

export function deleteApiProfile(id: string): Promise<void> {
  return invoke("delete_api_profile", { id });
}

/// Guarda a chave no cofre do Windows. Não há função para ler a chave de volta.
export function setApiProfileKey(id: string, key: string): Promise<void> {
  return invoke("set_api_profile_key", { id, key });
}

export function apiProfileHasKey(id: string): Promise<boolean> {
  return invoke("api_profile_has_key", { id });
}

/// Manda um prompt mínimo pelo perfil e devolve a resposta do modelo.
export function testApiProfile(id: string): Promise<string> {
  return invoke("test_api_profile", { id });
}

/// Busca a lista de modelos do perfil salvo na API. Não grava nada: a tela decide.
export function refreshApiModels(id: string): Promise<RemoteModels> {
  return invoke("refresh_api_models", { id });
}

/// Busca a lista de modelos com a chave que está na tela, antes de salvar. A chave não é gravada.
export function listProviderModels(preset: string, baseUrl: string, apiKey: string): Promise<RemoteModels> {
  return invoke("list_provider_models", { preset, baseUrl, apiKey });
}

/// Avisa as telas que a lista de perfis mudou (ver ApiProfilesSection e ChatView).
export const PROFILES_CHANGED = "luna:profiles-changed";
/// Avisa o chat que a lista de plugins mudou (instalar, desinstalar, ligar ou desligar).
export const PLUGINS_CHANGED = "luna:plugins-changed";

/// Nome do catálogo oficial embutido (ver src-tauri/marketplace/official.json).
export const OFFICIAL_SOURCE = "oficial";

export interface CatalogFile {
  path: string;
  sha256: string;
  content: string | null;
  url: string | null;
}

export interface CatalogPlugin {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  entry: string;
  permissions: string[];
  files: CatalogFile[];
}

export interface Catalog {
  name: string;
  plugins: CatalogPlugin[];
}

export interface PluginsState {
  disabled: string[];
}

export function listCatalogSources(): Promise<string[]> {
  return invoke("list_catalog_sources");
}

/// Baixa e confere o catálogo antes de guardar a URL.
export function addCatalogSource(url: string): Promise<Catalog> {
  return invoke("add_catalog_source", { url });
}

export function removeCatalogSource(url: string): Promise<void> {
  return invoke("remove_catalog_source", { url });
}

/// `source` é `OFFICIAL_SOURCE` ou uma URL já adicionada.
export function loadCatalog(source: string): Promise<Catalog> {
  return invoke("load_catalog", { source });
}

export function installCatalogPlugin(source: string, id: string): Promise<void> {
  return invoke("install_catalog_plugin", { source, id });
}

export function uninstallPlugin(id: string): Promise<void> {
  return invoke("uninstall_plugin", { id });
}

/// Abre o seletor de pastas para escolher um plugin no computador. `null` quando cancela.
export async function pickPluginFolder(): Promise<string | null> {
  const picked = await open({ directory: true, multiple: false });
  return typeof picked === "string" ? picked : null;
}

/// Lê o manifesto de uma pasta escolhida, sem instalar: para mostrar as permissões antes.
export function inspectLocalPlugin(folder: string): Promise<PluginManifest> {
  return invoke("inspect_local_plugin", { folder });
}

/// Instala um plugin de uma pasta escolhida no computador.
export function installLocalPlugin(folder: string): Promise<PluginManifest> {
  return invoke("install_local_plugin", { folder });
}

/// Abre a pasta de plugins no gerenciador de arquivos do sistema.
export function openPluginsFolder(): Promise<void> {
  return invoke("open_plugins_folder");
}

/// Cria um plugin novo com o modelo na pasta de plugins. Devolve a pasta criada.
export function createPlugin(id: string, name: string): Promise<string> {
  return invoke("create_plugin", { id, name });
}

export function getPluginsState(): Promise<PluginsState> {
  return invoke("get_plugins_state");
}

export function setPluginEnabled(id: string, enabled: boolean): Promise<PluginsState> {
  return invoke("set_plugin_enabled", { id, enabled });
}
