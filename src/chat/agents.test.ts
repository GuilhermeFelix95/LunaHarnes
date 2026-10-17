import { describe, expect, it } from "vitest";
import type { ApiPreset, ApiProfile } from "../types";
import { agentKey, agentOptions } from "./agents";

const presets: ApiPreset[] = [
  { preset: "deepSeek", label: "DeepSeek", engine: "claude", defaultBaseUrl: "https://api.deepseek.com/anthropic", suggestedModels: [], defaultModel: "" },
  { preset: "openAi", label: "OpenAI (chave)", engine: "codex", defaultBaseUrl: "", suggestedModels: [], defaultModel: "" },
];

const profiles: ApiProfile[] = [
  { id: "p1", name: "DeepSeek", preset: "deepSeek", baseUrl: "", models: [], defaultModel: null },
  { id: "p2", name: "OpenAI pessoal", preset: "openAi", baseUrl: "", models: [], defaultModel: null },
];

describe("agentes da conversa", () => {
  it("a chave é o motor, ou o motor mais o perfil", () => {
    expect(agentKey("claude")).toBe("claude");
    expect(agentKey("codex", null)).toBe("codex");
    expect(agentKey("claude", "p1")).toBe("api:p1");
  });

  it("o seletor lista os dois CLIs e depois cada perfil com o motor dele", () => {
    expect(agentOptions(profiles, presets).map((o) => [o.key, o.label, o.engine])).toEqual([
      ["claude", "Claude Code", "claude"],
      ["codex", "Codex", "codex"],
      ["api:p1", "DeepSeek · via Claude Code", "claude"],
      ["api:p2", "OpenAI pessoal · via Codex", "codex"],
    ]);
  });
});
