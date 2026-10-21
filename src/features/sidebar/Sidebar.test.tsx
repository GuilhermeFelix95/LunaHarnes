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

describe("Sidebar: marca", () => {
  it("a marca é o Átomo, não a lua", () => {
    const { container } = render(
      <Sidebar conversations={items} activeId={null} onNew={vi.fn()} onAddProject={vi.fn()} onOpen={vi.fn()} onDelete={vi.fn()} onSettings={vi.fn()} />,
    );
    const img = container.querySelector(".sidebar__brand img");

    expect(img?.getAttribute("src")).toBe("/luna/logo.svg");
  });
});

describe("Sidebar: rolagem e ações", () => {
  it("só a lista de projetos rola; a marca e o rodapé ficam fora dela", () => {
    const { container } = render(
      <Sidebar conversations={items} activeId={null} onNew={vi.fn()} onAddProject={vi.fn()} onOpen={vi.fn()} onDelete={vi.fn()} onSettings={vi.fn()} />,
    );
    const list = container.querySelector(".sidebar__list");

    expect(list?.querySelector(".sidebar__project")).toBeTruthy();
    expect(list?.querySelector(".sidebar__foot")).toBeNull();
    expect(container.querySelector(".sidebar__foot")).toBeTruthy();
  });

  it("a meta do plano fica no rodapé, logo abaixo de Configurações", () => {
    localStorage.clear();
    const { container } = render(
      <Sidebar conversations={items} activeId={null} onNew={vi.fn()} onAddProject={vi.fn()} onOpen={vi.fn()} onDelete={vi.fn()} onSettings={vi.fn()} />,
    );
    const foot = container.querySelector(".sidebar__foot") as HTMLElement;
    const slider = screen.getByRole("slider", { name: "Contexto do plano" });

    expect(foot.contains(slider)).toBe(true);
    expect(foot.children[0].className).toBe("sidebar__settings");
    fireEvent.change(slider, { target: { value: "70" } });
    expect(localStorage.getItem("luna.planTarget")).toBe("70");
  });

  it("renomear troca o título pelo campo em linha e confirma com Enter", () => {
    const onRename = vi.fn();
    render(<Sidebar conversations={items} activeId={null} onNew={vi.fn()} onAddProject={vi.fn()} onOpen={vi.fn()} onDelete={vi.fn()} onSettings={vi.fn()} onRename={onRename} />);

    fireEvent.click(screen.getByRole("button", { name: "Renomear Revisar o login" }));
    const field = screen.getByLabelText("Novo nome da conversa");
    fireEvent.change(field, { target: { value: "  Login novo  " } });
    fireEvent.keyDown(field, { key: "Enter" });

    expect(onRename).toHaveBeenCalledWith("a", "Login novo");
  });

  it("Esc cancela a renomeação e um nome vazio não é salvo", () => {
    const onRename = vi.fn();
    render(<Sidebar conversations={items} activeId={null} onNew={vi.fn()} onAddProject={vi.fn()} onOpen={vi.fn()} onDelete={vi.fn()} onSettings={vi.fn()} onRename={onRename} />);

    fireEvent.click(screen.getByRole("button", { name: "Renomear Revisar o login" }));
    const field = screen.getByLabelText("Novo nome da conversa");
    fireEvent.change(field, { target: { value: "   " } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onRename).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.queryByLabelText("Novo nome da conversa")).toBeNull();
  });

  it("remover o projeto avisa a conversa com o caminho da pasta", () => {
    const onRemoveProject = vi.fn();
    render(<Sidebar conversations={items} activeId={null} onNew={vi.fn()} onAddProject={vi.fn()} onOpen={vi.fn()} onDelete={vi.fn()} onSettings={vi.fn()} onRemoveProject={onRemoveProject} />);

    fireEvent.click(screen.getByRole("button", { name: "Remover projeto LunaHarnes" }));

    expect(onRemoveProject).toHaveBeenCalledWith("C:\\LunaHarnes");
  });
});

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

describe("Sidebar: modo navegador abaixo de Configurações", () => {
  it("o botão fica logo abaixo de Configurações e liga o modo navegador", () => {
    const onBrowserMode = vi.fn();
    render(
      <Sidebar conversations={items} activeId={null} onNew={vi.fn()} onAddProject={vi.fn()} onOpen={vi.fn()} onDelete={vi.fn()} onSettings={vi.fn()} browserMode={false} onBrowserMode={onBrowserMode} />,
    );

    const settings = screen.getByRole("button", { name: /Configurações/ });
    const browser = screen.getByRole("button", { name: "Modo navegador" });
    expect(settings.compareDocumentPosition(browser) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(browser);
    expect(onBrowserMode).toHaveBeenCalledWith(true);
  });

  it("com o modo ligado, o mesmo botão vira Modo LunaCode e volta ao normal", () => {
    const onBrowserMode = vi.fn();
    render(
      <Sidebar conversations={items} activeId={null} onNew={vi.fn()} onAddProject={vi.fn()} onOpen={vi.fn()} onDelete={vi.fn()} onSettings={vi.fn()} browserMode onBrowserMode={onBrowserMode} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Modo LunaCode" }));
    expect(onBrowserMode).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("button", { name: "Modo navegador" })).toBeNull();
  });
});

describe("Sidebar: recolhida no modo navegador", () => {
  it("no modo navegador a sidebar recebe a classe de recolhida", () => {
    const { container } = render(
      <Sidebar conversations={items} activeId={null} onNew={vi.fn()} onAddProject={vi.fn()} onOpen={vi.fn()} onDelete={vi.fn()} onSettings={vi.fn()} browserMode onBrowserMode={vi.fn()} />,
    );

    expect(container.querySelector(".sidebar")!.className).toContain("sidebar--collapsed");
  });
});
