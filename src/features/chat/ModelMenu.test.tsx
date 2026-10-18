import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ModelOption } from "../../types";
import { ModelMenu } from "./ModelMenu";

const model = (id: string, contextWindow?: number): ModelOption => ({
  id,
  label: id.split("/").pop() ?? id,
  description: null,
  efforts: [],
  default: false,
  contextWindow,
});

const MANY = [
  model("nvidia/nemotron-3.5-super-vl:free", 131072),
  model("anthropic/claude-sonnet-5.5", 1_000_000),
  ...Array.from({ length: 8 }, (_, i) => model(`vendor/modelo-${i}`)),
];

describe("ModelMenu", () => {
  it("com muitos modelos, a busca filtra a lista e escolhe o modelo", () => {
    const onChange = vi.fn();
    render(<ModelMenu models={MANY} value={MANY[0].id} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Modelo" }));
    fireEvent.change(screen.getByLabelText("Buscar modelo"), { target: { value: "claude" } });

    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      expect.stringContaining("claude-sonnet-5.5"),
    ]);
    fireEvent.click(screen.getByRole("option", { name: /claude-sonnet-5.5/ }));
    expect(onChange).toHaveBeenCalledWith("anthropic/claude-sonnet-5.5");
  });

  it("mostra a janela de contexto ao lado do nome", () => {
    render(<ModelMenu models={MANY} value={MANY[0].id} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Modelo" }));

    expect(screen.getByRole("option", { name: /nemotron-3.5-super-vl:free/ }).textContent).toContain("131k de contexto");
    expect(screen.getByRole("option", { name: /claude-sonnet-5.5/ }).textContent).toContain("1M de contexto");
  });

  it("a lista de modelos fica dentro da área com rolagem; a busca fica fora dela", () => {
    render(<ModelMenu models={MANY} value={MANY[0].id} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Modelo" }));

    const list = document.querySelector(".model-menu__list");
    expect(list?.querySelectorAll("[role='option']")).toHaveLength(MANY.length);
    expect(list?.querySelector("input")).toBeNull();
  });

  it("com poucos modelos não mostra campo de busca", () => {
    render(<ModelMenu models={MANY.slice(0, 3)} value={MANY[0].id} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Modelo" }));

    expect(screen.queryByLabelText("Buscar modelo")).toBeNull();
  });
});
