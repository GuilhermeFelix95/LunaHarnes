import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceChip } from "./WorkspaceChip";

function setup(recent: string[] = []) {
  const props = {
    cwd: "C:\\Users\\guilh\\LunaHarnes",
    recent,
    onPick: vi.fn(),
    onBrowse: vi.fn(),
  };
  render(<WorkspaceChip {...props} />);
  return props;
}

describe("WorkspaceChip", () => {
  it("mostra o nome da pasta, com o caminho completo no tooltip", () => {
    setup();
    const trigger = screen.getByRole("button", { name: /LunaHarnes/ });

    expect(trigger.getAttribute("title")).toBe("C:\\Users\\guilh\\LunaHarnes");
  });

  it("o menu oferece trocar pasta", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: /LunaHarnes/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Trocar pasta/ }));

    expect(props.onBrowse).toHaveBeenCalledOnce();
  });

  it("lista pastas recentes sem repetir a atual e escolher uma troca para ela", () => {
    const props = setup(["C:\\Users\\guilh\\LunaHarnes", "C:\\Users\\guilh\\Downloads"]);
    fireEvent.click(screen.getByRole("button", { name: /LunaHarnes/ }));

    const items = screen.getAllByRole("menuitem").map((el) => el.textContent);
    expect(items).toEqual(["Trocar pasta…", "Downloads"]);

    fireEvent.click(screen.getByRole("menuitem", { name: "Downloads" }));
    expect(props.onPick).toHaveBeenCalledWith("C:\\Users\\guilh\\Downloads");
  });

  it("sem repositório git não há seção de branch", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /LunaHarnes/ }));

    expect(screen.queryByText("Trabalhar numa branch")).toBeNull();
    expect(screen.queryByLabelText("Nova branch")).toBeNull();
  });

  it("escolher uma branch existente pede a worktree dela, sem criar branch", () => {
    const onPickBranch = vi.fn();
    render(
      <WorkspaceChip
        cwd="C:\\Users\\guilh\\LunaHarnes"
        recent={[]}
        onPick={vi.fn()}
        onBrowse={vi.fn()}
        branches={["feature/x", "main"]}
        onPickBranch={onPickBranch}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Branch · 2" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "feature/x" }));

    expect(onPickBranch).toHaveBeenCalledWith("feature/x", false);
  });

  it("a branch atual aparece ao lado da pasta, mesmo que seja a única", () => {
    render(
      <WorkspaceChip
        cwd="C:\\Users\\guilh\\LunaHarnes"
        recent={[]}
        onPick={vi.fn()}
        onBrowse={vi.fn()}
        branches={["main"]}
        currentBranch="main"
        onPickBranch={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "main" })).toBeTruthy();
  });

  it("o botão da branch atual lista todas, e escolher outra pede a worktree dela", () => {
    const onPickBranch = vi.fn();
    render(
      <WorkspaceChip
        cwd="C:\\Users\\guilh\\LunaHarnes"
        recent={[]}
        onPick={vi.fn()}
        onBrowse={vi.fn()}
        branches={["feature/x", "main"]}
        currentBranch="main"
        onPickBranch={onPickBranch}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "main" }));

    expect(screen.getByRole("menuitem", { name: "main (atual)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "feature/x" }));
    expect(onPickBranch).toHaveBeenCalledWith("feature/x", false);
  });

  it("a branch atual aparece destacada no menu e marcada como atual para leitores de tela", () => {
    render(
      <WorkspaceChip
        cwd="C:\\Users\\guilh\\LunaHarnes"
        recent={[]}
        onPick={vi.fn()}
        onBrowse={vi.fn()}
        branches={["feature/x", "main"]}
        currentBranch="main"
        onPickBranch={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "main" }));

    const current = screen.getByRole("menuitem", { name: "main (atual)" });
    expect(current.getAttribute("aria-current")).toBe("true");
    expect(current.className).toContain("workspace-chip__item--current");
    expect(screen.getByRole("menuitem", { name: "feature/x" }).getAttribute("aria-current")).toBeNull();
  });

  it("abrir o menu de branch pede a lista atualizada, e fechar não pede", () => {
    const onOpenBranches = vi.fn();
    render(
      <WorkspaceChip
        cwd="C:\\Users\\guilh\\LunaHarnes"
        recent={[]}
        onPick={vi.fn()}
        onBrowse={vi.fn()}
        branches={["main"]}
        currentBranch="main"
        onPickBranch={vi.fn()}
        onOpenBranches={onOpenBranches}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "main" }));
    expect(onOpenBranches).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "main" }));
    expect(onOpenBranches).toHaveBeenCalledOnce();
  });

  it("criar uma branch nova usa o nome digitado e a cria a partir da atual", () => {
    const onPickBranch = vi.fn();
    render(
      <WorkspaceChip
        cwd="C:\\Users\\guilh\\LunaHarnes"
        recent={[]}
        onPick={vi.fn()}
        onBrowse={vi.fn()}
        branches={["main", "dev"]}
        onPickBranch={onPickBranch}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Branch · 2" }));
    const input = screen.getByLabelText("Nova branch");
    const create = screen.getByRole("button", { name: "Criar" });

    expect((create as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "  nova  " } });
    fireEvent.click(create);

    expect(onPickBranch).toHaveBeenCalledWith("nova", true);
  });

  it("o menu oferece trabalhar sem pasta, que escolhe a pasta do app", () => {
    const onPick = vi.fn();
    render(<WorkspaceChip cwd={"C:\\Users\\guilh\\LunaHarnes"} recent={[]} onPick={onPick} onBrowse={vi.fn()} freeFolder={"C:\\app\\Sem pasta"} />);
    fireEvent.click(screen.getByRole("button", { name: /LunaHarnes/ }));

    fireEvent.click(screen.getByRole("menuitem", { name: "Trabalhar sem pasta" }));

    expect(onPick).toHaveBeenCalledWith("C:\\app\\Sem pasta");
  });

  it("dentro da pasta sem projeto, a opção some do menu", () => {
    render(<WorkspaceChip cwd={"C:\\app\\Sem pasta"} recent={[]} onPick={vi.fn()} onBrowse={vi.fn()} freeFolder={"C:\\app\\Sem pasta"} />);
    fireEvent.click(screen.getByRole("button", { name: /Sem pasta/ }));

    expect(screen.queryByRole("menuitem", { name: "Trabalhar sem pasta" })).toBeNull();
  });
});
