import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cliUpdateCheck } from "../api";
import type { CliUpdateInfo } from "../types";
import { CLI_CHECK_EVERY_MS, startCliUpdateChecks, updatesToShow } from "./cliUpdates";

vi.mock("../api", () => ({
  cliUpdateCheck: vi.fn(async () => []),
}));

const info = (overrides: Partial<CliUpdateInfo>): CliUpdateInfo => ({
  provider: "claude",
  installed: "2.1.305",
  latest: "2.1.309",
  updateAvailable: true,
  canUpdate: true,
  error: null,
  ...overrides,
});

describe("updatesToShow", () => {
  it("mostra só as CLIs com versão nova e sem erro", () => {
    const list = [
      info({ provider: "claude" }),
      info({ provider: "codex", updateAvailable: false, latest: "0.161.0" }),
      info({ provider: "copilot", updateAvailable: false, error: "sem rede" }),
    ];

    expect(updatesToShow(list, false).map((i) => i.provider)).toEqual(["claude"]);
  });

  it("com o agente rodando, não mostra aviso nenhum", () => {
    expect(updatesToShow([info({ provider: "claude" })], true)).toEqual([]);
  });
});

describe("startCliUpdateChecks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(cliUpdateCheck).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("checa depois do atraso inicial e depois a cada hora, entregando o resultado", async () => {
    const onResult = vi.fn();
    vi.mocked(cliUpdateCheck).mockResolvedValue([info({})]);

    const stop = startCliUpdateChecks(onResult, 1000);
    expect(cliUpdateCheck).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(cliUpdateCheck).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith([info({})]);

    await vi.advanceTimersByTimeAsync(CLI_CHECK_EVERY_MS);
    expect(cliUpdateCheck).toHaveBeenCalledTimes(2);
    stop();
  });

  it("uma falha da checagem não entrega resultado nem derruba o app", async () => {
    const onResult = vi.fn();
    vi.mocked(cliUpdateCheck).mockRejectedValue(new Error("sem rede"));

    const stop = startCliUpdateChecks(onResult, 1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onResult).not.toHaveBeenCalled();
    stop();
  });
});
