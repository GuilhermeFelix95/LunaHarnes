import type { ApiProfile, ModelOption } from "../types";

/// Nome curto para mostrar no seletor: o último trecho do id ("nvidia/nemotron-3.5-super-vl:free" -> "nemotron-3.5-super-vl:free").
/// O id completo continua sendo o que vai para a API.
export function shortModelName(id: string): string {
  const parts = id.split("/");
  return parts[parts.length - 1] || id;
}

/// Modelos de um perfil de API para o seletor do chat. `free` esconde os pagos (só OpenRouter usa).
export function profileModelOptions(profile?: ApiProfile): ModelOption[] {
  if (!profile) return [];
  const free = profile.modelScope === "free";
  return profile.models
    .filter((id) => !free || id.endsWith(":free"))
    .map((id) => ({
      id,
      label: shortModelName(id),
      description: null,
      efforts: [],
      default: id === profile.defaultModel,
      contextWindow: profile.contextWindows?.[id],
    }));
}
