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
    fireEvent.click(screen.getByRole("button", { name: /LunaHarnes/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "feature/x" }));

    expect(onPickBranch).toHaveBeenCalledWith("feature/x", false);
  });

  it("criar uma branch nova usa o nome digitado e a cria a partir da atual", () => {
    const onPickBranch = vi.fn();
    render(
      <WorkspaceChip
        cwd="C:\\Users\\guilh\\LunaHarnes"
        recent={[]}
        onPick={vi.fn()}
        onBrowse={vi.fn()}
        branches={["main"]}
        onPickBranch={onPickBranch}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /LunaHarnes/ }));
    const input = screen.getByLabelText("Nova branch");
    const create = screen.getByRole("button", { name: "Criar" });

    expect((create as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "  nova  " } });
    fireEvent.click(create);

    expect(onPickBranch).toHaveBeenCalledWith("nova", true);
  });
});
