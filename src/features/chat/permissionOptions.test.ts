import { describe, expect, it } from "vitest";
import { permissionOptions } from "./Composer";

describe("permissões por motor", () => {
  it("o Cline só oferece o acesso total", () => {
    expect(permissionOptions("cline").map((o) => o.value)).toEqual(["fullAccess"]);
  });

  it("o Antigravity oferece só leitura e aceitar edições, sem acesso total", () => {
    expect(permissionOptions("antigravity").map((o) => o.value)).toEqual(["readOnly", "acceptEdits"]);
  });

  it("os outros motores mantêm as três permissões", () => {
    expect(permissionOptions("claude").map((o) => o.value)).toEqual(["readOnly", "acceptEdits", "fullAccess"]);
    expect(permissionOptions(undefined).map((o) => o.value)).toEqual(["readOnly", "acceptEdits", "fullAccess"]);
  });
});
