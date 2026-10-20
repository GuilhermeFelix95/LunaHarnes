import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FilesPanel } from "./FilesPanel";

vi.mock("../../api", () => ({
  listProjectDir: vi.fn(async (_cwd: string, path: string) => {
    if (path === "") {
      return [
        { name: "src", path: "src", isDir: true },
        { name: "README.md", path: "README.md", isDir: false },
      ];
    }
    if (path === "src") return [{ name: "main.rs", path: "src/main.rs", isDir: false }];
    throw new Error("não é uma pasta");
  }),
}));

import { listProjectDir } from "../../api";

describe("aba Arquivos", () => {
  beforeEach(() => {
    vi.mocked(listProjectDir).mockClear();
  });

  it("mostra a raiz do projeto, com pastas antes dos arquivos", async () => {
    render(<FilesPanel cwd="/projeto" />);

    const rows = await screen.findAllByRole("treeitem");
    expect(rows.map((r) => r.textContent)).toEqual(["src", "README.md"]);
    expect(listProjectDir).toHaveBeenCalledWith("/projeto", "");
  });

  it("abrir uma pasta lê só ela e mostra os itens dentro", async () => {
    render(<FilesPanel cwd="/projeto" />);

    fireEvent.click(await screen.findByRole("treeitem", { name: /src/ }));

    expect(await screen.findByRole("treeitem", { name: /main\.rs/ })).toBeTruthy();
    expect(listProjectDir).toHaveBeenCalledWith("/projeto", "src");
  });

  it("clicar num arquivo avisa quem abre o editor, sem ler o conteúdo aqui", async () => {
    const onOpen = vi.fn();
    render(<FilesPanel cwd="/projeto" onOpen={onOpen} />);

    fireEvent.click(await screen.findByRole("treeitem", { name: /README/ }));

    expect(onOpen).toHaveBeenCalledWith("README.md");
  });

  it("o arquivo que está no editor fica marcado na árvore", async () => {
    render(<FilesPanel cwd="/projeto" activePath="README.md" />);

    expect((await screen.findByRole("treeitem", { name: /README/ })).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("treeitem", { name: /src/ }).getAttribute("aria-selected")).toBe("false");
  });

  it("filtro pelo nome esconde arquivos que não batem, mas mantém as pastas", async () => {
    render(<FilesPanel cwd="/projeto" />);
    await screen.findByRole("treeitem", { name: /README/ });

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });

    expect(screen.queryByRole("treeitem", { name: /README/ })).toBeNull();
    expect(screen.getByRole("treeitem", { name: /src/ })).toBeTruthy();
  });

  it("falha ao ler a raiz aparece como aviso, sem travar o painel", async () => {
    vi.mocked(listProjectDir).mockRejectedValueOnce("não foi possível ler a pasta");
    render(<FilesPanel cwd="/projeto" />);

    expect((await screen.findByRole("alert")).textContent).toContain("não foi possível ler a pasta");
  });
});
