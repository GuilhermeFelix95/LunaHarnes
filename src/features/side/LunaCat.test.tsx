import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { LunaCat } from "./LunaCat";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("LunaCat", () => {
  it("trabalhando: mostra o gatinho andando e troca de quadro", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { container } = render(<LunaCat working />);

    const img = screen.getByRole("img", { name: "Gatinho lunar andando" });
    expect(container.querySelector(".luna-cat--working")).toBeTruthy();
    const first = img.getAttribute("src");

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(img.getAttribute("src")).not.toBe(first);
    expect(img.getAttribute("src")).toMatch(/^\/luna\/walk-\d{2}\.png$/);
  });

  it("ao fim de cada ciclo, faz uma pausa antes de andar de novo", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    render(<LunaCat working />);

    const img = screen.getByRole("img", { name: "Gatinho lunar andando" });
    const first = img.getAttribute("src");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // Ainda na pausa do primeiro quadro.
    expect(img.getAttribute("src")).toBe(first);

    // A pausa sorteada aqui é de 2750 ms: depois de mais 2000 ms, já andou.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(img.getAttribute("src")).not.toBe(first);
  });

  it("parado: mostra o gatinho dormindo com zZ, sem trocar de quadro", () => {
    vi.useFakeTimers();
    const { container } = render(<LunaCat working={false} />);

    const img = screen.getByRole("img", { name: "Gatinho lunar dormindo" });
    expect(img.getAttribute("src")).toBe("/luna/cat-04.png");
    expect(container.querySelectorAll(".luna-cat__z")).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(img.getAttribute("src")).toBe("/luna/cat-04.png");
  });
});
