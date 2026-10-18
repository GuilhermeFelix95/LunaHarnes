import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LunaCat } from "./LunaCat";

describe("LunaCat", () => {
  it("trabalhando: o gatinho anda", () => {
    const { container } = render(<LunaCat working />);

    expect(screen.getByRole("img", { name: "Gatinho lunar andando" })).toBeTruthy();
    expect(container.querySelector(".luna-cat--working")).toBeTruthy();
    expect(container.querySelector(".luna-cat--sleeping")).toBeNull();
    expect(container.querySelectorAll(".luna-cat__foot")).toHaveLength(2);
  });

  it("parado: o gatinho dorme com zZ", () => {
    const { container } = render(<LunaCat working={false} />);

    expect(screen.getByRole("img", { name: "Gatinho lunar dormindo" })).toBeTruthy();
    expect(container.querySelector(".luna-cat--sleeping")).toBeTruthy();
    expect(container.querySelectorAll(".luna-cat__z")).toHaveLength(2);
  });
});
