import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalPanel } from "./TerminalPanel";

// O xterm desenha em canvas, que o jsdom não tem. O teste troca por um dublê que só guarda o que recebe.
const xterm = vi.hoisted(() => ({
  instances: [] as Array<{ written: string[]; onDataCb?: (d: string) => void; disposed: boolean }>,
}));

vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    written: string[] = [];
    onDataCb?: (d: string) => void;
    disposed = false;
    constructor() {
      xterm.instances.push(this);
    }
    loadAddon() {}
    open() {}
    write(text: string) {
      this.written.push(text);
    }
    onData(cb: (d: string) => void) {
      this.onDataCb = cb;
      return { dispose() {} };
    }
    dispose() {
      this.disposed = true;
    }
  },
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit() {}
  },
}));

vi.mock("../../api", () => ({
  terminalOpen: vi.fn(async () => "term-1"),
  terminalWrite: vi.fn(async () => {}),
  terminalResize: vi.fn(async () => {}),
  terminalClose: vi.fn(async () => {}),
  onTerminalData: vi.fn(async () => () => {}),
  onTerminalExit: vi.fn(async () => () => {}),
}));

import * as api from "../../api";

describe("TerminalPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    xterm.instances.length = 0;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  it("abre o shell na pasta do projeto com o tamanho da tela", async () => {
    render(<TerminalPanel cwd={"C:\\projeto"} />);

    await waitFor(() => expect(api.terminalOpen).toHaveBeenCalledWith("C:\\projeto", 80, 24));
  });

  it("o que o usuário digita vai para o shell aberto", async () => {
    render(<TerminalPanel cwd={"C:\\projeto"} />);
    await waitFor(() => expect(api.terminalOpen).toHaveBeenCalled());
    await waitFor(() => expect(xterm.instances[0].onDataCb).toBeDefined());

    // Espera o id chegar antes de digitar.
    await new Promise((r) => setTimeout(r, 0));
    xterm.instances[0].onDataCb!("dir\r");

    await waitFor(() => expect(api.terminalWrite).toHaveBeenCalledWith("term-1", "dir\r"));
  });

  it("ao sair da tela fecha o shell e libera o xterm", async () => {
    const { unmount } = render(<TerminalPanel cwd={"C:\\projeto"} />);
    await waitFor(() => expect(api.terminalOpen).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));

    unmount();

    await waitFor(() => expect(api.terminalClose).toHaveBeenCalledWith("term-1"));
    expect(xterm.instances[0].disposed).toBe(true);
  });

  it("falha ao abrir mostra o motivo no painel", async () => {
    vi.mocked(api.terminalOpen).mockRejectedValueOnce("PowerShell não encontrado no PATH.");
    const { findByRole } = render(<TerminalPanel cwd={"C:\\projeto"} />);

    expect((await findByRole("alert")).textContent).toContain("PowerShell não encontrado");
  });
});
