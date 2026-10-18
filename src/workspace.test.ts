import { beforeEach, describe, expect, it } from "vitest";
import { LAST_WORKSPACE_KEY, loadLastWorkspace, saveLastWorkspace } from "./workspace";

describe("última pasta de projeto", () => {
  beforeEach(() => localStorage.clear());

  it("sem pasta salva, não há pasta para reabrir", () => {
    expect(loadLastWorkspace()).toBeUndefined();
  });

  it("guarda a última pasta usada e devolve a mesma", () => {
    saveLastWorkspace("C:\projetos\site");
    expect(localStorage.getItem(LAST_WORKSPACE_KEY)).toBe("C:\projetos\site");
    expect(loadLastWorkspace()).toBe("C:\projetos\site");
  });

  it("pasta vazia não substitui a salva", () => {
    saveLastWorkspace("C:\projetos\site");
    saveLastWorkspace("");
    expect(loadLastWorkspace()).toBe("C:\projetos\site");
  });
});
