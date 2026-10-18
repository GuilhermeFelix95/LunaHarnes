import { afterEach, describe, expect, it } from "vitest";
import {
  APPROVAL_PROMPT,
  contextUnderstood,
  extractPlan,
  DEFAULT_PLAN_TARGET,
  loadPlanTarget,
  PLAN_TARGET_KEY,
  planFromReply,
  planInstruction,
  QUESTION_PROTOCOL,
  savePlanTarget,
  withPlanInstruction,
} from "./planning";

describe("modo plano", () => {
  it("mantém o pedido do usuário depois da instrução de planejamento", () => {
    const prompt = withPlanInstruction("crie um login");

    expect(prompt.startsWith(planInstruction(DEFAULT_PLAN_TARGET))).toBe(true);
    expect(prompt.endsWith("crie um login")).toBe(true);
  });

  it("a meta de contexto aparece na instrução, e o agente tem de marcar a % em toda resposta", () => {
    const text = planInstruction(65);

    expect(text).toContain("65%");
    expect(text).toContain("Contexto entendido: X%");
  });

  it("a resposta com a pergunta de aprovação vira o plano na aba Plano", () => {
    const approval = {
      text: "Plano: editar o host e o ChatView.",
      questions: [{ question: "Aprovar o plano?", options: ["Aprovar e executar", "Ainda não"], multiple: false }],
    };

    expect(planFromReply(approval, true)).toBe("Plano: editar o host e o ChatView.");
  });

  it("rodada de perguntas não vira plano, e resposta sem planejamento também não", () => {
    const round = { text: "Contexto entendido: 30%", questions: [{ question: "Banco?", options: ["A", "B"], multiple: false }] };

    expect(planFromReply(round, true)).toBeNull();
    expect(planFromReply({ text: "Plano pronto", questions: null }, false)).toBeNull();
    expect(planFromReply({ text: "  ", questions: null }, true)).toBeNull();
  });

  it("lê a % marcada pelo agente, limitada a 100", () => {
    expect(contextUnderstood("Contexto entendido: 42%\n\nPerguntas abaixo.")).toBe(42);
    expect(contextUnderstood("contexto entendido:  120 %")).toBe(100);
    expect(contextUnderstood("sem a linha")).toBeNull();
  });

  describe("meta de contexto salva", () => {
    afterEach(() => localStorage.removeItem(PLAN_TARGET_KEY));

    it("vale o padrão até o usuário escolher", () => {
      expect(loadPlanTarget()).toBe(DEFAULT_PLAN_TARGET);
    });

    it("guarda a escolha e recusa valores fora de 50 a 100", () => {
      savePlanTarget(90);
      expect(loadPlanTarget()).toBe(90);

      localStorage.setItem(PLAN_TARGET_KEY, "10");
      expect(loadPlanTarget()).toBe(DEFAULT_PLAN_TARGET);
    });
  });

  it("o modo plano ensina o bloco de perguntas, que vira seletor", () => {
    const prompt = withPlanInstruction("crie um login");

    expect(prompt).toContain(QUESTION_PROTOCOL);
    expect(prompt).toContain("luna-perguntas");
  });

  it("a instrução proíbe editar antes da aprovação", () => {
    expect(planInstruction(DEFAULT_PLAN_TARGET)).toContain("Não altere arquivos");
    expect(planInstruction(DEFAULT_PLAN_TARGET)).toContain("Só comece a executar depois que o usuário aprovar");
  });

  it("a aprovação pede execução, sem a instrução de planejamento", () => {
    expect(APPROVAL_PROMPT).toContain("execute o plano agora");
    expect(APPROVAL_PROMPT).not.toContain("modo de planejamento");
  });

  it("a spec sai no modelo to-spec, em spec/, com as seções na ordem", () => {
    const sections = ["## Problem Statement", "## Solution", "## User Stories", "## Implementation Decisions", "## Testing Decisions", "## Out of Scope", "## Further Notes"];

    expect(APPROVAL_PROMPT).toContain("spec/");
    const positions = sections.map((section) => APPROVAL_PROMPT.indexOf(section));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});

describe("extractPlan", () => {
  it("separa o resumo do plano completo", () => {
    const reply = "Resumo em três linhas.\nVou criar a tela.\nFalta só aprovar.\n```luna-plano\n## Contexto\nTarefas.\n## Arquivos a alterar\n- src/App.tsx: cria a tela\n```";

    const parts = extractPlan(reply);

    expect(parts?.summary).toBe("Resumo em três linhas.\nVou criar a tela.\nFalta só aprovar.");
    expect(parts?.plan).toContain("## Arquivos a alterar");
  });

  it("sem bloco ou com bloco vazio, não há plano separado", () => {
    expect(extractPlan("Só um texto.")).toBeNull();
    expect(extractPlan("```luna-plano\n   \n```")).toBeNull();
  });

  it("o prompt do modo plano pede o resumo e o bloco luna-plano", () => {
    const text = planInstruction(DEFAULT_PLAN_TARGET);

    expect(text).toContain("luna-plano");
    expect(text).toContain("## Não mexer");
  });
});
