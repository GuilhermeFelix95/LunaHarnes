import { beforeEach, describe, expect, it, vi } from "vitest";
import { stopAllForUpdate } from "./api";
import { findUpdate } from "./updates";

const downloadAndInstall = vi.fn();
const relaunch = vi.fn();
const check = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({ check: () => check() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: () => relaunch() }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn() }));
vi.mock("./api", () => ({ stopAllForUpdate: vi.fn() }));

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
