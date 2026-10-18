import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LunaCat } from "./LunaCat";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("LunaCat", () => {
  it("trabalhando: mostra o mascote balançando e sem zZ", () => {
    const { container } = render(<LunaCat working />);

    expect(screen.getByRole("img", { name: "Mascote da Luna trabalhando" })).toBeTruthy();
    expect(container.querySelector(".luna-bot--working")).toBeTruthy();
    expect(container.querySelector(".luna-bot--sleeping")).toBeNull();
  });

  it("parado: dorme com olhos fechados, boca aberta roncando e zZ", () => {
    const { container } = render(<LunaCat working={false} />);

    expect(screen.getByRole("img", { name: "Mascote da Luna dormindo" })).toBeTruthy();
    expect(container.querySelector(".luna-bot--sleeping")).toBeTruthy();
    expect(container.querySelectorAll(".luna-bot__z")).toHaveLength(2);
    expect(container.querySelector(".luna-bot__eye-closed")).toBeTruthy();
    expect(container.querySelector(".luna-bot__mouth-open")).toBeTruthy();
  });

  it("não faz ação ao montar", () => {
    const { container } = render(<LunaCat working={false} />);

    expect(container.querySelector(".luna-bot--hello")).toBeNull();
    expect(container.querySelector(".luna-bot--happy")).toBeNull();
  });

  it("ao começar o turno acena, e ao terminar pula de alegria; cada ação dura 1,2 s", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<LunaCat working={false} />);

    rerender(<LunaCat working />);
    expect(container.querySelector(".luna-bot--hello")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(container.querySelector(".luna-bot--hello")).toBeNull();

    rerender(<LunaCat working={false} />);
    expect(container.querySelector(".luna-bot--happy")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(container.querySelector(".luna-bot--happy")).toBeNull();
  });

  it("parado e sem ação, de tempos em tempos faz uma careta que some depois", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { container } = render(<LunaCat working={false} />);

    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(container.querySelector(".luna-bot--face-wink")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(container.querySelector(".luna-bot--face-wink")).toBeNull();
  });

  it("trabalhando não faz caretas", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { container } = render(<LunaCat working />);

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(container.querySelector("[class*='luna-bot--face-']")).toBeNull();
  });
});
