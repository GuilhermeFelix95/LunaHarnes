import { describe, expect, it } from "vitest";
import { APPROVAL_PROMPT, PLAN_INSTRUCTION, QUESTION_PROTOCOL, withPlanInstruction } from "./planning";

describe("modo plano", () => {
  it("mantém o pedido do usuário depois da instrução de planejamento", () => {
    const prompt = withPlanInstruction("crie um login");

    expect(prompt.startsWith(PLAN_INSTRUCTION)).toBe(true);
    expect(prompt.endsWith("crie um login")).toBe(true);
  });

  it("o modo plano ensina o bloco de perguntas, que vira seletor", () => {
    const prompt = withPlanInstruction("crie um login");

    expect(prompt).toContain(QUESTION_PROTOCOL);
    expect(prompt).toContain("luna-perguntas");
  });

  it("a instrução proíbe editar antes da aprovação", () => {
    expect(PLAN_INSTRUCTION).toContain("Não altere arquivos");
    expect(PLAN_INSTRUCTION).toContain("Só comece a executar depois que o usuário aprovar");
  });

  it("a aprovação pede execução, sem a instrução de planejamento", () => {
    expect(APPROVAL_PROMPT).toContain("Execute-o agora");
    expect(APPROVAL_PROMPT).not.toContain("modo de planejamento");
  });
});
