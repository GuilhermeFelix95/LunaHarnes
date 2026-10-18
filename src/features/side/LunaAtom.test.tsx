import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LunaAtom } from "./LunaAtom";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("LunaAtom", () => {
  it("trabalhando: mostra o Átomo com os elétrons correndo, sem zZ", () => {
    const { container } = render(<LunaAtom working />);

    expect(screen.getByRole("img", { name: "Mascote da Luna trabalhando" })).toBeTruthy();
    expect(container.querySelector(".luna-atom--working")).toBeTruthy();
    expect(container.querySelector(".luna-atom--sleeping")).toBeNull();
    expect(container.querySelectorAll(".luna-atom__electron")).toHaveLength(3);
    expect(container.querySelector(".luna-atom__electron--0 animateMotion")?.getAttribute("dur")).toBe("1.6s");
  });

  it("parado: dorme com olhos fechados, boca aberta roncando, elétrons lentos e zZ", () => {
    const { container } = render(<LunaAtom working={false} />);

    expect(screen.getByRole("img", { name: "Mascote da Luna dormindo" })).toBeTruthy();
    expect(container.querySelector(".luna-atom--sleeping")).toBeTruthy();
    expect(container.querySelectorAll(".luna-atom__z")).toHaveLength(2);
    expect(container.querySelector(".luna-atom__eye-closed")).toBeTruthy();
    expect(container.querySelector(".luna-atom__mouth-open")).toBeTruthy();
    expect(container.querySelector(".luna-atom__electron--0 animateMotion")?.getAttribute("dur")).toBe("7s");
  });

  it("não faz ação ao montar", () => {
    const { container } = render(<LunaAtom working={false} />);

    expect(container.querySelector(".luna-atom--hello")).toBeNull();
    expect(container.querySelector(".luna-atom--happy")).toBeNull();
  });

  it("ao começar o turno acena, e ao terminar pula de alegria; cada ação dura 1,2 s", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<LunaAtom working={false} />);

    rerender(<LunaAtom working />);
    expect(container.querySelector(".luna-atom--hello")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(container.querySelector(".luna-atom--hello")).toBeNull();

    rerender(<LunaAtom working={false} />);
    expect(container.querySelector(".luna-atom--happy")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(container.querySelector(".luna-atom--happy")).toBeNull();
  });

  it("parado e sem ação, de tempos em tempos faz uma careta que some depois", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { container } = render(<LunaAtom working={false} />);

    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(container.querySelector(".luna-atom--face-wink")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(container.querySelector(".luna-atom--face-wink")).toBeNull();
  });

  it("trabalhando não faz caretas", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { container } = render(<LunaAtom working />);

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(container.querySelector("[class*='luna-atom--face-']")).toBeNull();
  });
});
