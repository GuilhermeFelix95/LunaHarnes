import { beforeEach, describe, expect, it, vi } from "vitest";
import * as plugin from "@tauri-apps/plugin-notification";
import { notificationsEnabled, notifyIfUnfocused, NOTIFY_KEY, setNotificationsEnabled } from "./notifications";

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn(async () => true),
  requestPermission: vi.fn(async () => "granted"),
  sendNotification: vi.fn(),
}));

describe("notificações", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("vêm ligadas por padrão e podem ser desligadas", () => {
    expect(notificationsEnabled()).toBe(true);
    setNotificationsEnabled(false);
    expect(localStorage.getItem(NOTIFY_KEY)).toBe("off");
    expect(notificationsEnabled()).toBe(false);
  });

  it("não avisa quando a janela está em foco", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    await notifyIfUnfocused("Resposta pronta", "ok");

    expect(plugin.sendNotification).not.toHaveBeenCalled();
  });

  it("avisa com a janela fora de foco", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    await notifyIfUnfocused("Resposta pronta", "\"oi\" terminou.");

    expect(plugin.sendNotification).toHaveBeenCalledWith({ title: "Resposta pronta", body: "\"oi\" terminou." });
  });

  it("não avisa quando o usuário desligou", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    setNotificationsEnabled(false);
    await notifyIfUnfocused("Resposta pronta", "x");

    expect(plugin.sendNotification).not.toHaveBeenCalled();
  });
});
