import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useStickToBottom } from "./useStickToBottom";

/// Simula a geometria de um elemento que rola (o jsdom não calcula layout).
function setGeometry(el: HTMLElement, scrollHeight: number, clientHeight: number) {
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: clientHeight });
}

function Harness({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { stuck, scrollToBottom } = useStickToBottom(ref, content);
  return (
    <>
      <div data-testid="box" ref={ref}>
        {content}
      </div>
      <span data-testid="stuck">{String(stuck)}</span>
      <button onClick={scrollToBottom}>fim</button>
    </>
  );
}

describe("useStickToBottom", () => {
  it("desce até o fim quando chega conteúdo novo", () => {
    const { rerender } = render(<Harness content="a" />);
    const box = screen.getByTestId("box");
    setGeometry(box, 2000, 500);

    rerender(<Harness content="ab" />);

    expect(box.scrollTop).toBe(2000);
  });

  it("para de seguir quando o usuário rola para cima e fica onde ele parou", () => {
    const { rerender } = render(<Harness content="a" />);
    const box = screen.getByTestId("box");
    setGeometry(box, 2000, 500);

    box.scrollTop = 300;
    fireEvent.scroll(box);
    expect(screen.getByTestId("stuck").textContent).toBe("false");

    setGeometry(box, 2600, 500);
    rerender(<Harness content="abc" />);
    expect(box.scrollTop).toBe(300);
  });

  it("voltar ao fim religa a rolagem automática", () => {
    const { rerender } = render(<Harness content="a" />);
    const box = screen.getByTestId("box");
    setGeometry(box, 2000, 500);
    box.scrollTop = 300;
    fireEvent.scroll(box);

    act(() => screen.getByText("fim").click());
    expect(screen.getByTestId("stuck").textContent).toBe("true");
    expect(box.scrollTop).toBe(2000);

    setGeometry(box, 2400, 500);
    rerender(<Harness content="abcd" />);
    expect(box.scrollTop).toBe(2400);
  });

  it("rolar até perto do fim também religa", () => {
    render(<Harness content="a" />);
    const box = screen.getByTestId("box");
    setGeometry(box, 2000, 500);
    box.scrollTop = 300;
    fireEvent.scroll(box);

    box.scrollTop = 1470;
    fireEvent.scroll(box);

    expect(screen.getByTestId("stuck").textContent).toBe("true");
  });
});
