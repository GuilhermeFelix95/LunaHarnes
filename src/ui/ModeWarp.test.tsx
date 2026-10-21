import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModeWarp } from "./ModeWarp";

describe("ModeWarp: animação ao entrar e sair do modo navegador", () => {
  it("ao receber uma troca, mostra o efeito de entrada", () => {
    const { container } = render(<ModeWarp run={{ id: 1, direction: "in" }} />);

    expect(container.querySelector(".mode-warp--in")).toBeTruthy();
  });

  it("ao sair, mostra o efeito de saída", () => {
    const { container } = render(<ModeWarp run={{ id: 2, direction: "out" }} />);

    expect(container.querySelector(".mode-warp--out")).toBeTruthy();
  });

  it("some quando a animação termina, sem ficar sobre a tela", () => {
    const { container } = render(<ModeWarp run={{ id: 3, direction: "in" }} />);

    act(() => {
      container.querySelector(".mode-warp")!.dispatchEvent(new Event("animationend", { bubbles: true }));
    });

    expect(container.querySelector(".mode-warp")).toBeNull();
  });

  it("sem troca, não mostra nada", () => {
    const { container } = render(<ModeWarp run={null} />);

    expect(container.querySelector(".mode-warp")).toBeNull();
  });
});
