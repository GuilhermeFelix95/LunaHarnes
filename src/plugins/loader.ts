import { listPlugins, readPluginEntry } from "../api";
import { importPluginSource, type PluginHost } from "./host";

/// Carrega todos os plugins válidos da pasta do usuário.
/// Erros de manifesto e de ativação vão para `host.errors`; os outros plugins seguem.
export async function loadInstalledPlugins(host: PluginHost): Promise<void> {
  const scan = await listPlugins();

  for (const { folder, message } of scan.errors) {
    host.errors.push(`${folder}: ${message}`);
  }

  for (const manifest of scan.plugins) {
    try {
      const source = await readPluginEntry(manifest.id);
      await host.load(manifest, () => importPluginSource(source));
    } catch (e) {
      host.errors.push(`${manifest.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
