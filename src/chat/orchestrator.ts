import type { ProviderKind } from "../types";

/// Papéis do orquestrador: quem planeja, quem executa o plano, quem conversa e quem executa as etapas como subagente.
export type OrchestratorRole = "plan" | "execute" | "chat" | "subagent";

export const ROLES: OrchestratorRole[] = ["plan", "execute", "chat", "subagent"];

export interface RoleModel {
  provider: ProviderKind;
  /** Perfil de API do papel (id em api-profiles.json). Ausente = login da CLI. */
  profileId?: string;
  model: string;
  effort?: string;
}

/// Papel sem entrada = usa a conversa atual.
export type Orchestrator = Partial<Record<OrchestratorRole, RoleModel>>;

/// Motor, perfil, modelo e esforço de um envio.
export interface Route {
  provider: ProviderKind;
  profileId: string | null;
  model: string;
  effort: string;
}

/// Motor, perfil e modelo que um envio usa. Sem escolha para o papel, vale a conversa atual.
/// Com escolha, vale só o que o papel escolheu: o perfil da conversa não passa para o papel
/// (um modelo do Claude não pode ir para o endpoint de outro provedor).
export function routeFor(role: OrchestratorRole | null, current: Route, orchestrator: Orchestrator): Route {
  const choice = role ? orchestrator[role] : undefined;
  if (!choice) return current;
  return {
    provider: choice.provider,
    profileId: choice.profileId ?? null,
    model: choice.model,
    effort: choice.effort ?? "",
  };
}
