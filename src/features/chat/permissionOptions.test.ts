import { describe, expect, it } from "vitest";
import { permissionOptions } from "./Composer";

describe("permissões por motor", () => {
  it("o Cline só oferece o acesso total", () => {
    expect(permissionOptions("cline").map((o) => o.value)).toEqual(["fullAccess"]);
  });

  it("os outros motores mantêm as três permissões", () => {
    expect(permissionOptions("claude").map((o) => o.value)).toEqual(["readOnly", "acceptEdits", "fullAccess"]);
    expect(permissionOptions(undefined).map((o) => o.value)).toEqual(["readOnly", "acceptEdits", "fullAccess"]);
  });
});
