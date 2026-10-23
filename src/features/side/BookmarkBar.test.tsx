import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserBookmark } from "../../api";
import { BookmarkBar } from "./BookmarkBar";

vi.mock("../../api", () => ({
  browserFavicon: vi.fn(async () => null),
}));

const bookmarks: BrowserBookmark[] = [
  { id: "a", title: "Alfa", url: "https://alfa.example/" },
  { id: "b", title: "Beta", url: "https://beta.example/" },
  { id: "c", title: "Gama", url: "https://gama.example/" },
];

/// Sem layout no jsdom: cada favorito mede 100 px e a barra tem 260 px, então cabem dois.
function simulateLayout() {
  const offset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  const client = Object.getOwnPropertyDescriptor(Element.prototype, "clientWidth");
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return this.classList.contains("browser__bookmark") && !this.classList.contains("browser__bookmark--hidden") ? 100 : 0;
    },
  });
  Object.defineProperty(Element.prototype, "clientWidth", {
    configurable: true,
    get() {
      return this.classList.contains("browser__bookmarks") ? 260 : 0;
    },
  });
  return () => {
    if (offset) Object.defineProperty(HTMLElement.prototype, "offsetWidth", offset);
    if (client) Object.defineProperty(Element.prototype, "clientWidth", client);
  };
}

describe("BookmarkBar", () => {
  let restore: () => void = () => {};
  beforeEach(() => {
    restore = () => {};
  });
  afterEach(() => restore());

  it("sem medida de layout, mostra todos os favoritos e nenhum botão »", () => {
    render(<BookmarkBar bookmarks={bookmarks} onOpen={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Mais favoritos" })).toBeNull();
    expect(screen.getByText("Gama")).toBeTruthy();
  });

  it("o que não cabe na linha vai para o menu » e não rola", () => {
    restore = simulateLayout();
    const { container } = render(<BookmarkBar bookmarks={bookmarks} onOpen={vi.fn()} onRemove={vi.fn()} />);

    const gama = container.querySelector('[data-bookmark-id="c"]') as HTMLElement;
    expect(gama.classList.contains("browser__bookmark--hidden")).toBe(true);
    expect(container.querySelector(".browser__bookmarks")?.className).toBe("browser__bookmarks");
    expect(screen.getByRole("button", { name: "Mais favoritos" })).toBeTruthy();
  });

  it("abre o menu » com os ocultos e abre o favorito escolhido", () => {
    restore = simulateLayout();
    const onOpen = vi.fn();
    render(<BookmarkBar bookmarks={bookmarks} onOpen={onOpen} onRemove={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Mais favoritos" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Gama/ }));

    expect(onOpen).toHaveBeenCalledWith(bookmarks[2]);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
