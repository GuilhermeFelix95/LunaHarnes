import type { ProviderKind } from "../types";

/// Nome de cada agente na interface e no contexto enviado a outro agente.
export const PROVIDER_LABELS: Record<ProviderKind, string> = {
  claude: "Claude Code",
  codex: "Codex",
};
