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

  it("perfil de API só continua quando o motor é o mesmo da conversa", () => {
    const withProfile: Route = { ...current, profileId: "deepseek" };

    expect(routeFor("chat", withProfile, { chat: { provider: "claude", model: "claude-haiku-5-5" } }).profileId).toBe("deepseek");
    expect(routeFor("chat", withProfile, { chat: { provider: "opencode", model: "opencode/big-pickle" } }).profileId).toBeNull();
  });

  it("sem esforço escolhido, o envio fica sem esforço", () => {
    expect(routeFor("subagent", current, { subagent: { provider: "claude", model: "claude-haiku-5-5" } }).effort).toBe("");
  });
});
