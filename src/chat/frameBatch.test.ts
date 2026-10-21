import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFrameBatch } from "./frameBatch";

// Quadros controlados pelo teste: o navegador só "desenha" quando o teste manda.
let frames: (() => void)[] = [];

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
    frames.push(cb);
    return frames.length;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/// Passa para o próximo quadro: roda os pedidos que estavam esperando.
function nextFrame() {
  const pending = frames;
  frames = [];
  pending.forEach((cb) => cb());
}

describe("createFrameBatch", () => {
  it("vários pedidos no mesmo quadro geram uma só execução", () => {
    const run = vi.fn();
    const batch = createFrameBatch(run);

    batch.schedule();
    batch.schedule();
    batch.schedule();
    expect(run).not.toHaveBeenCalled();

    nextFrame();
    expect(run).toHaveBeenCalledOnce();
  });

  it("flush executa na hora e o quadro seguinte não repete a execução", () => {
    const run = vi.fn();
    const batch = createFrameBatch(run);

    batch.schedule();
    batch.flush();
    expect(run).toHaveBeenCalledOnce();

    nextFrame();
    expect(run).toHaveBeenCalledOnce();
  });

  it("flush sem pedido pendente não executa nada", () => {
    const run = vi.fn();
    const batch = createFrameBatch(run);

    batch.flush();
    expect(run).not.toHaveBeenCalled();
  });

  it("depois de executar, um novo pedido volta a agendar", () => {
    const run = vi.fn();
    const batch = createFrameBatch(run);

    batch.schedule();
    nextFrame();
    batch.schedule();
    nextFrame();

    expect(run).toHaveBeenCalledTimes(2);
  });
});
