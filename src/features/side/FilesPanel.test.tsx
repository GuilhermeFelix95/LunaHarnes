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
  readProjectFile: vi.fn(async () => "fn main() {}"),
}));

import { listProjectDir, readProjectFile } from "../../api";

describe("aba Arquivos", () => {
  beforeEach(() => {
    vi.mocked(listProjectDir).mockClear();
    vi.mocked(readProjectFile).mockClear();
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

  it("clicar num arquivo mostra o conteúdo, só para leitura", async () => {
    render(<FilesPanel cwd="/projeto" />);

    fireEvent.click(await screen.findByRole("treeitem", { name: /README/ }));

    await waitFor(() => expect(document.querySelector(".files__code")?.textContent).toBe("fn main() {}"));
    expect(readProjectFile).toHaveBeenCalledWith("/projeto", "README.md");
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

  it("com arquivo aberto, a prévia fica ao lado da árvore e avisa o painel", async () => {
    const onPreview = vi.fn();
    const { container } = render(<FilesPanel cwd="/projeto" onPreview={onPreview} />);

    fireEvent.click(await screen.findByRole("treeitem", { name: /README/ }));

    await waitFor(() => expect(container.querySelector(".files__split--preview")).toBeTruthy());
    expect(container.querySelector(".files__list .files__tree")).toBeTruthy();
    expect(container.querySelector(".files__viewer .files__code")).toBeTruthy();
    expect(onPreview).toHaveBeenLastCalledWith(true);
  });

  it("fechar a prévia devolve o layout de uma coluna e avisa o painel", async () => {
    const onPreview = vi.fn();
    const { container } = render(<FilesPanel cwd="/projeto" onPreview={onPreview} />);
    fireEvent.click(await screen.findByRole("treeitem", { name: /README/ }));
    await waitFor(() => expect(container.querySelector(".files__code")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Fechar arquivo" }));

    expect(container.querySelector(".files__split--preview")).toBeNull();
    expect(onPreview).toHaveBeenLastCalledWith(false);
  });
});
