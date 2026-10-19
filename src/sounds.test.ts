import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getThemeMedia } from "./plugins/themeRegistry";
import { loadSound, playReplySound, playSound, saveSound, SOUND_KEY, SOUNDS } from "./sounds";

vi.mock("./plugins/themeRegistry", () => ({ getThemeMedia: vi.fn(() => ({})) }));

function fakeContext() {
  const oscillator = () => ({
    type: "sine",
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });
  const gain = () => ({
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  });
  return {
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(oscillator),
    createGain: vi.fn(gain),
    close: vi.fn(async () => undefined),
  };
}

describe("sons de resposta", () => {
  let ctx: ReturnType<typeof fakeContext>;
  let Context: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    ctx = fakeContext();
    Context = vi.fn(function () {
      return ctx;
    });
    Object.defineProperty(window, "AudioContext", { configurable: true, value: Context });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(window, "AudioContext");
  });

  it("o padrão é o sino; a escolha salva é lida de volta", () => {
    expect(loadSound()).toBe("sino");

    saveSound("miau");
    expect(localStorage.getItem(SOUND_KEY)).toBe("miau");
    expect(loadSound()).toBe("miau");
  });

  it("valor salvo desconhecido volta para o padrão", () => {
    localStorage.setItem(SOUND_KEY, "trombeta");

    expect(loadSound()).toBe("sino");
  });

  it("tem cinco sons à escolha", () => {
    expect(SOUNDS.map((s) => s.id)).toEqual(["sino", "gota", "lua", "miau", "pop"]);
  });

  it("cada som monta uma nota por componente e fecha o contexto depois", () => {
    playSound("lua");

    expect(Context).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
    vi.runAllTimers();
    expect(ctx.close).toHaveBeenCalledTimes(1);
  });

  it("com o som desligado, a resposta não toca nada", () => {
    saveSound("off");

    playReplySound();

    expect(Context).not.toHaveBeenCalled();
  });

  it("com um som escolhido, a resposta toca esse som", () => {
    saveSound("pop");

    playReplySound();

    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
  });
});

describe("som de resposta do tema", () => {
  it("toca o arquivo do tema escolhido em vez do som padrão", () => {
    const play = vi.fn(async () => {});
    vi.stubGlobal("Audio", vi.fn(function () { return { play }; }));
    vi.mocked(getThemeMedia).mockReturnValueOnce({ reply: "blob:ding" });

    playReplySound();

    expect(Audio).toHaveBeenCalledWith("blob:ding");
    expect(play).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
