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
});
