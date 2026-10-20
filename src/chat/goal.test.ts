import { describe, expect, it } from "vitest";
import { GOAL_DONE_MARKER, goalInstruction, goalShouldContinue, isGoalDone, MAX_GOAL_ROUNDS, stripGoalMarker } from "./goal";

describe("modo /meta", () => {
  it("a instrução leva a condição e o marcador de término", () => {
    const text = goalInstruction("todos os testes passam");

    expect(text).toContain("todos os testes passam");
    expect(text).toContain(GOAL_DONE_MARKER);
  });

  it("só considera terminado quando o marcador é a última linha", () => {
    expect(isGoalDone("ainda trabalhando")).toBe(false);
    expect(isGoalDone(`pronto\n${GOAL_DONE_MARKER}`)).toBe(true);
    expect(isGoalDone(`${GOAL_DONE_MARKER}\nvou continuar`)).toBe(false);
  });

  it("o marcador some do texto exibido ao usuário", () => {
    expect(stripGoalMarker(`pronto\n${GOAL_DONE_MARKER}`)).toBe("pronto");
    expect(stripGoalMarker("sem marcador")).toBe("sem marcador");
  });

  it("repete sem marcador até o teto de rodadas", () => {
    expect(MAX_GOAL_ROUNDS).toBe(20);
    expect(goalShouldContinue("ainda não", 1)).toBe(true);
    expect(goalShouldContinue("ainda não", MAX_GOAL_ROUNDS)).toBe(false);
  });

  it("para quando o marcador aparece, antes do teto", () => {
    expect(goalShouldContinue(`feito\n${GOAL_DONE_MARKER}`, 1)).toBe(false);
  });
});
