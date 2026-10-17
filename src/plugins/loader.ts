import { getPluginsState, listPlugins, readPluginEntry } from "../api";
import { importPluginSource, type PluginHost } from "./host";

/// Carrega todos os plugins válidos da pasta do usuário, exceto os desativados.
/// Erros de manifesto e de ativação vão para `host.errors`; os outros plugins seguem.
export async function loadInstalledPlugins(host: PluginHost): Promise<void> {
  const [scan, state] = await Promise.all([listPlugins(), getPluginsState()]);

  for (const { folder, message } of scan.errors) {
    host.errors.push(`${folder}: ${message}`);
  }

  for (const manifest of scan.plugins) {
    if (state.disabled.includes(manifest.id)) continue;
    try {
      const source = await readPluginEntry(manifest.id);
      await host.load(manifest, () => importPluginSource(source));
    } catch (e) {
      host.errors.push(`${manifest.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
