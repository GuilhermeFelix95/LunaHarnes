import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalTabs } from "./TerminalTabs";

// O xterm desenha em canvas, que o jsdom não tem. O teste troca por um dublê que não faz nada.
vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this.options = options;
    }
    loadAddon() {}
    open() {}
    write() {}
    onData() {
      return { dispose() {} };
    }
    dispose() {}
  },
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit() {}
  },
}));

vi.mock("../../api", () => ({
  terminalOpen: vi.fn(),
  terminalWrite: vi.fn(async () => {}),
  terminalResize: vi.fn(async () => {}),
  terminalClose: vi.fn(async () => {}),
  onTerminalData: vi.fn(async () => () => {}),
  onTerminalExit: vi.fn(async () => () => {}),
}));

import * as api from "../../api";

describe("TerminalTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let next = 0;
    vi.mocked(api.terminalOpen).mockImplementation(async () => `term-${++next}`);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  it("abre um segundo terminal numa segunda aba", async () => {
    render(<TerminalTabs cwd={"C:\\projeto"} />);
    await waitFor(() => expect(api.terminalOpen).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Novo terminal" }));

    await waitFor(() => expect(api.terminalOpen).toHaveBeenCalledTimes(2));
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("com quatro terminais abertos, o botão de novo terminal fica desabilitado e explica o limite", async () => {
    render(<TerminalTabs cwd={"C:\\projeto"} />);
    await waitFor(() => expect(api.terminalOpen).toHaveBeenCalledTimes(1));
    for (let i = 2; i <= 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Novo terminal" }));
      await waitFor(() => expect(api.terminalOpen).toHaveBeenCalledTimes(i));
    }

    const add = screen.getByRole("button", { name: "Novo terminal" }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(screen.getByText(/4 terminais/)).toBeTruthy();
  });

  it("fechar uma aba encerra só o shell dela", async () => {
    render(<TerminalTabs cwd={"C:\\projeto"} />);
    await waitFor(() => expect(api.terminalOpen).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Novo terminal" }));
    await waitFor(() => expect(api.terminalOpen).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 0));

    fireEvent.click(screen.getAllByRole("button", { name: "Fechar terminal" })[1]);

    await waitFor(() => expect(api.terminalClose).toHaveBeenCalledWith("term-2"));
    expect(api.terminalClose).not.toHaveBeenCalledWith("term-1");
    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });
});
