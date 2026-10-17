import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renderiza negrito, lista e código inline", () => {
    const { container } = render(<Markdown text={"**forte** e `codigo`\n\n- um\n- dois"} />);

    expect(container.querySelector("strong")?.textContent).toBe("forte");
    expect(container.querySelector("code")?.textContent).toBe("codigo");
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("bloco de código ganha botão copiar", () => {
    const { container } = render(<Markdown text={"```ts\nconst a = 1;\n```"} />);

    expect(container.querySelector("pre")?.textContent).toContain("const a = 1;");
    expect(screen.getByText("Copiar")).toBeTruthy();
  });

  it("HTML vindo do modelo não vira elemento real", () => {
    const { container } = render(<Markdown text={'<script>alert("x")</script> oi'} />);

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>");
  });

  it("links não viram âncoras navegáveis dentro do app", () => {
    const { container } = render(<Markdown text={"veja [o site](https://example.com)"} />);

    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector(".md-link")?.textContent).toBe("o site");
  });
});
