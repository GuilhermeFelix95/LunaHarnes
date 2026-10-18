import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LunaCat } from "./LunaCat";

describe("LunaCat", () => {
  it("trabalhando: o gatinho corre atrás do ratinho", () => {
    const { container } = render(<LunaCat working />);

    expect(screen.getByRole("img", { name: "Gatinho lunar correndo atrás de um ratinho" })).toBeTruthy();
    expect(container.querySelector(".luna-cat--working")).toBeTruthy();
    expect(container.querySelector(".luna-cat--sleeping")).toBeNull();
  });

  it("parado: o gatinho dorme enquanto o ratinho come, com zZ", () => {
    const { container } = render(<LunaCat working={false} />);

    expect(screen.getByRole("img", { name: "Gatinho lunar dormindo enquanto o ratinho come" })).toBeTruthy();
    expect(container.querySelector(".luna-cat--sleeping")).toBeTruthy();
    expect(container.querySelectorAll(".luna-cat__z")).toHaveLength(2);
    expect(container.querySelector(".luna-cat__mouse-eat")).toBeTruthy();
  });
});
