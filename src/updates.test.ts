import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stopAllForUpdate } from "./api";
import { showToast } from "./ui/toast";
import { checkOnStartup, findUpdate, startUpdateChecks, UPDATE_CHECK_EVERY_MS } from "./updates";

const downloadAndInstall = vi.fn();
const relaunch = vi.fn();
const check = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({ check: () => check() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: () => relaunch() }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn() }));
vi.mock("./api", () => ({ stopAllForUpdate: vi.fn() }));
vi.mock("./ui/toast", () => ({ showToast: vi.fn() }));

beforeEach(() => {
  check.mockReset();
  downloadAndInstall.mockReset();
  relaunch.mockReset();
  vi.mocked(stopAllForUpdate).mockReset();
});

describe("findUpdate", () => {
  it("devolve null quando não há versão nova", async () => {
    check.mockResolvedValue(null);

    expect(await findUpdate()).toBeNull();
  });

  it("instala encerrando execuções e terminais antes, e reabre o app depois", async () => {
    check.mockResolvedValue({ version: "0.1.1", body: "Notas", downloadAndInstall });
    downloadAndInstall.mockResolvedValue(undefined);
    vi.mocked(stopAllForUpdate).mockResolvedValue(undefined);

    const update = await findUpdate();
    expect(update?.version).toBe("0.1.1");
    expect(update?.notes).toBe("Notas");

    await update?.install();

    expect(stopAllForUpdate).toHaveBeenCalledBefore(downloadAndInstall);
    expect(downloadAndInstall).toHaveBeenCalledBefore(relaunch);
  });

  it("não baixa nada quando não consegue encerrar as execuções", async () => {
    check.mockResolvedValue({ version: "0.1.1", downloadAndInstall });
    vi.mocked(stopAllForUpdate).mockRejectedValue(new Error("falhou"));

    const update = await findUpdate();

    await expect(update?.install()).rejects.toThrow("falhou");
    expect(downloadAndInstall).not.toHaveBeenCalled();
  });
});

describe("checkOnStartup", () => {
  beforeEach(() => {
    vi.mocked(showToast).mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("sem versão nova, não mostra nada", async () => {
    check.mockResolvedValue(null);

    await checkOnStartup();

    expect(showToast).not.toHaveBeenCalled();
  });

  it("com versão nova, avisa na tela com o número da versão", async () => {
    check.mockResolvedValue({ version: "0.1.1", body: "", downloadAndInstall });

    await checkOnStartup();

    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: "info", title: expect.stringContaining("0.1.1") }));
  });

  it("falha na checagem não mostra aviso e não lança", async () => {
    check.mockRejectedValue(new Error("sem rede"));

    await expect(checkOnStartup()).resolves.toBeUndefined();
    expect(showToast).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("startUpdateChecks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    check.mockResolvedValue(null);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("confere ao abrir e de novo depois de uma hora", async () => {
    const stop = startUpdateChecks();

    await vi.advanceTimersByTimeAsync(5000);
    expect(check).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_EVERY_MS - 5000);
    expect(check).toHaveBeenCalledTimes(2);

    stop();
  });

  it("ao parar, não confere mais", async () => {
    const stop = startUpdateChecks();
    stop();

    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_EVERY_MS * 2);

    expect(check).not.toHaveBeenCalled();
  });
});
