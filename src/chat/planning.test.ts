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
