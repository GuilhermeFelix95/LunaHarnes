import { describe, expect, it } from "vitest";
import { routeFor, type Route } from "./orchestrator";

const current: Route = { provider: "claude", profileId: null, model: "claude-sonnet-5-5", effort: "high" };

describe("routeFor", () => {
  it("sem papel, ou papel sem escolha, vale a conversa atual", () => {
    expect(routeFor(null, current, {})).toBe(current);
    expect(routeFor("execute", current, {})).toBe(current);
  });

  it("o papel escolhido troca motor, modelo e esforço do envio", () => {
    const route = routeFor("plan", current, { plan: { provider: "codex", model: "gpt-5.5", effort: "xhigh" } });

    expect(route).toEqual({ provider: "codex", profileId: null, model: "gpt-5.5", effort: "xhigh" });
  });

  it("papel sem perfil usa a CLI, mesmo com a conversa num perfil de API", () => {
    const withProfile: Route = { ...current, profileId: "deepseek" };

    expect(routeFor("chat", withProfile, { chat: { provider: "claude", model: "claude-haiku-5-5" } }).profileId).toBeNull();
    expect(routeFor("chat", withProfile, { chat: { provider: "opencode", model: "opencode/big-pickle" } }).profileId).toBeNull();
  });

  it("papel com perfil leva o perfil e o modelo do próprio perfil", () => {
    const withProfile: Route = { ...current, profileId: "deepseek" };

    expect(routeFor("chat", withProfile, { chat: { provider: "claude", profileId: "openrouter", model: "qwen/qwen3-coder:free" } })).toEqual({
      provider: "claude",
      profileId: "openrouter",
      model: "qwen/qwen3-coder:free",
      effort: "",
    });
  });

  it("sem esforço escolhido, o envio fica sem esforço", () => {
    expect(routeFor("subagent", current, { subagent: { provider: "claude", model: "claude-haiku-5-5" } }).effort).toBe("");
  });
});
