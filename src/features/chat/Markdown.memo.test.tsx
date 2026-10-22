import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Markdown } from "./Markdown";

// Conta as renderizações do conversor: cada digitação no composer re-renderiza o chat, e o Markdown não deve refazer o texto à toa.
const renders = vi.hoisted(() => ({ count: 0 }));
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => {
    renders.count++;
    return <p>{children}</p>;
  },
}));

describe("Markdown: custo ao digitar", () => {
  it("não refaz o texto quando o pai re-renderiza com o mesmo texto e o mesmo link", () => {
    const onOpenLink = () => {};
    const { rerender } = render(<Markdown text="olá" onOpenLink={onOpenLink} />);
    const before = renders.count;

    rerender(<Markdown text="olá" onOpenLink={onOpenLink} />);

    expect(renders.count).toBe(before);
  });
});
