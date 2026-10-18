import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationSummary } from "../../types";
import { clampSidebarWidth, filterByTitle, Sidebar, SIDEBAR_WIDTH_KEY } from "./Sidebar";

const conv = (id: string, title: string): ConversationSummary => ({
  id,
  title,
  provider: "claude",
  cwd: "C:\\LunaHarnes",
  updatedAt: Date.now(),
});

const items = [conv("a", "Revisar o login"), conv("b", "Criar página de preços")];

function setup() {
  const props = {
    conversations: items,
    activeId: null,
    onNew: vi.fn(),
    onAddProject: vi.fn(),
    onOpen: vi.fn(),
    onDelete: vi.fn(),
    onSettings: vi.fn(),
  };
  render(<Sidebar {...props} />);
  return props;
}

describe("filterByTitle", () => {
  it("ignora maiúsculas e acentos", () => {
    expect(filterByTitle(items, "PRECOS").map((c) => c.id)).toEqual(["b"]);
    expect(filterByTitle(items, "pagina").map((c) => c.id)).toEqual(["b"]);
  });

  it("texto vazio devolve tudo", () => {
    expect(filterByTitle(items, "   ")).toHaveLength(2);
  });
});

describe("Sidebar busca", () => {
  it("filtra as conversas pelo título enquanto digita", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Buscar conversas"), { target: { value: "login" } });

    expect(screen.getByText("Revisar o login")).toBeTruthy();
    expect(screen.queryByText("Criar página de preços")).toBeNull();
  });

  it("mostra mensagem quando nada bate com a busca", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Buscar conversas"), { target: { value: "zzz" } });

    expect(screen.getByText("Nenhuma conversa encontrada.")).toBeTruthy();
  });

  it("sem conversas não mostra o campo de busca", () => {
    render(
      <Sidebar
        conversations={[]}
        activeId={null}
        onNew={vi.fn()}
        onAddProject={vi.fn()}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onSettings={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Buscar conversas")).toBeNull();
  });

  it("o botão Configurações do rodapé abre a página", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: /Configurações/ }));
    expect(props.onSettings).toHaveBeenCalledOnce();
  });
});

describe("Sidebar: largura pela alça", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  });

  it("a largura fica entre 200 px e 40% da janela", () => {
    expect(clampSidebarWidth(120, 1280)).toBe(200);
    expect(clampSidebarWidth(900, 1280)).toBe(512);
    expect(clampSidebarWidth(260, 1280)).toBe(260);
  });

  it("setas da alça alargam e estreitam, e a largura é guardada", () => {
    render(<Sidebar conversations={items} activeId={null} onNew={vi.fn()} onAddProject={vi.fn()} onOpen={vi.fn()} onDelete={vi.fn()} onSettings={vi.fn()} />);
    const handle = screen.getByRole("separator", { name: "Largura da barra lateral" });

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle.getAttribute("aria-valuenow")).toBe("276");
    expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe("276");

    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(handle.getAttribute("aria-valuenow")).toBe("244");
  });

  it("ao abrir, volta a largura guardada da última vez", () => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, "300");
    render(<Sidebar conversations={items} activeId={null} onNew={vi.fn()} onAddProject={vi.fn()} onOpen={vi.fn()} onDelete={vi.fn()} onSettings={vi.fn()} />);

    expect(screen.getByRole("separator", { name: "Largura da barra lateral" }).getAttribute("aria-valuenow")).toBe("300");
  });
});
