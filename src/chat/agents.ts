import type { ApiPreset, ApiProfile, ProviderKind } from "../types";
import { PROVIDER_LABELS } from "./providers";

/// Agente da conversa: o CLI oficial (`claude`, `codex`) ou um perfil de API (`api:<id>`).
/// O motor (Claude Code ou Codex) vem junto: o perfil só troca o endereço e a chave.
export interface AgentOption {
  key: string;
  label: string;
  engine: ProviderKind;
  profileId?: string;
}

export function agentKey(engine: ProviderKind, profileId?: string | null): string {
  return profileId ? `api:${profileId}` : engine;
}

/// Motor de um perfil, pelo preset dele. Sem preset conhecido, cai no Claude Code.
export function engineOf(profile: ApiProfile, presets: ApiPreset[]): ProviderKind {
  return presets.find((p) => p.preset === profile.preset)?.engine ?? "claude";
}

/// Opções do seletor: os dois CLIs e depois cada perfil de API ("DeepSeek · via Claude Code").
export function agentOptions(profiles: ApiProfile[], presets: ApiPreset[]): AgentOption[] {
  const base: AgentOption[] = [
    { key: "claude", label: PROVIDER_LABELS.claude, engine: "claude" },
    { key: "codex", label: PROVIDER_LABELS.codex, engine: "codex" },
    { key: "opencode", label: PROVIDER_LABELS.opencode, engine: "opencode" },
  ];
  const fromProfiles = profiles.map((p) => {
    const engine = engineOf(p, presets);
    return {
      key: agentKey(engine, p.id),
      label: `${p.name} · via ${PROVIDER_LABELS[engine]}`,
      engine,
      profileId: p.id,
    };
  });
  return [...base, ...fromProfiles];
}
