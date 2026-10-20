import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyPluginTheme, setPluginThemes } from "../../plugins/themeRegistry";
import { LunaAtom } from "./LunaAtom";

vi.mock("../../api", () => ({
  readPluginAsset: vi.fn(async () => ({ mime: "image/png", data: "UE5H" })),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("LunaAtom", () => {
  it("trabalhando: mostra o robô com os olhos abertos e a antena acesa, sem zZ", () => {
    const { container } = render(<LunaAtom working />);

    expect(screen.getByRole("img", { name: "Mascote da Luna trabalhando" })).toBeTruthy();
    expect(container.querySelector(".luna-atom--working")).toBeTruthy();
    expect(container.querySelector(".luna-atom--sleeping")).toBeNull();
    expect(container.querySelectorAll(".luna-atom__eye")).toHaveLength(2);
    expect(container.querySelector(".luna-atom__antenna-ball")).toBeTruthy();
    expect(container.querySelector(".luna-atom--sleeping .luna-atom__z")).toBeNull();
  });

  it("parado: dorme com olhos fechados, boca reta e zZ", () => {
    const { container } = render(<LunaAtom working={false} />);

    expect(screen.getByRole("img", { name: "Mascote da Luna dormindo" })).toBeTruthy();
    expect(container.querySelector(".luna-atom--sleeping")).toBeTruthy();
    expect(container.querySelectorAll(".luna-atom__z")).toHaveLength(2);
    expect(container.querySelectorAll(".luna-atom__eye-closed")).toHaveLength(2);
    expect(container.querySelector(".luna-atom__mouth-flat")).toBeTruthy();
  });

  it("usa o desenho do ícone do app, com a lua", () => {
    const { container } = render(<LunaAtom working={false} />);

    expect(container.querySelector(".luna-atom__moon")).toBeTruthy();
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 512 512");
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

describe("LunaAtom com mascote de tema", () => {
  it("mostra a imagem do tema escolhido no lugar do robô", async () => {
    URL.createObjectURL = vi.fn(() => "blob:luna");
    URL.revokeObjectURL = vi.fn();
    setPluginThemes([{ id: "verde", name: "Verde", dark: false, tokens: {}, pluginId: "hello", mascot: "asset(assets/luna.png)" }]);
    applyPluginTheme("plugin:hello/verde");

    render(<LunaAtom working={false} />);

    await waitFor(() => expect(document.querySelector("img.luna-atom__image")?.getAttribute("src")).toBe("blob:luna"));
    expect(document.querySelector("svg")).toBeNull();
    applyPluginTheme(null);
  });
});
