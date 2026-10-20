import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChangesPanel } from "./ChangesPanel";

vi.mock("../../api", () => ({
  getChanges: vi.fn(),
  getFileDiff: vi.fn(),
  discardChange: vi.fn(async () => {}),
}));

import * as api from "../../api";

const changed = {
  isRepo: true,
  files: [
    { path: "src/a.ts", status: "modified", additions: 3, deletions: 1 },
    { path: "novo.md", status: "untracked", additions: null, deletions: null },
  ],
} as const;

describe("ChangesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista os arquivos com as linhas adicionadas e removidas", async () => {
    vi.mocked(api.getChanges).mockResolvedValue(changed as never);
    render(<ChangesPanel cwd={"C:\\projeto"} version={0} />);

    expect(await screen.findByText("src/a.ts")).toBeTruthy();
    expect(screen.getByText("+3")).toBeTruthy();
    expect(screen.getByText("−1")).toBeTruthy();
    expect(screen.getByText("novo.md")).toBeTruthy();
  });

  it("avisa quando a pasta não é um repositório git", async () => {
    vi.mocked(api.getChanges).mockResolvedValue({ isRepo: false, files: [] });
    render(<ChangesPanel cwd={"C:\\solta"} version={0} />);

    expect(await screen.findByText(/não é um repositório git/)).toBeTruthy();
  });

  it("clicar num arquivo mostra o diff com as linhas coloridas", async () => {
    vi.mocked(api.getChanges).mockResolvedValue(changed as never);
    vi.mocked(api.getFileDiff).mockResolvedValue("@@ -1 +1,2 @@\n um\n+tres\n-velho\n");
    render(<ChangesPanel cwd={"C:\\projeto"} version={0} />);

    fireEvent.click(await screen.findByRole("button", { name: /^src\/a\.ts/ }));

    await waitFor(() => expect(api.getFileDiff).toHaveBeenCalledWith("C:\\projeto", "src/a.ts"));
    expect(await screen.findByText("+tres", { exact: false })).toBeTruthy();
    expect(document.querySelector(".diff-line--add")?.textContent).toContain("+tres");
    expect(document.querySelector(".diff-line--del")?.textContent).toContain("-velho");
  });

  it("o diff mostra o número da linha antiga e da nova em cada linha", async () => {
    vi.mocked(api.getChanges).mockResolvedValue(changed as never);
    vi.mocked(api.getFileDiff).mockResolvedValue("@@ -10,2 +10,3 @@\n um\n+tres\n-velho\n dois\n");
    render(<ChangesPanel cwd={"C:\\projeto"} version={0} />);

    fireEvent.click(await screen.findByRole("button", { name: /^src\/a\.ts/ }));

    await waitFor(() => expect(document.querySelector(".diff-line--add")).not.toBeNull());
    const added = Array.from(document.querySelector(".diff-line--add")!.querySelectorAll(".diff-num")).map((c) => c.textContent);
    const removed = Array.from(document.querySelector(".diff-line--del")!.querySelectorAll(".diff-num")).map((c) => c.textContent);
    expect(added).toEqual(["", "11"]);
    expect(removed).toEqual(["11", ""]);
  });

  it("clicar de novo no arquivo aberto fecha o diff", async () => {
    vi.mocked(api.getChanges).mockResolvedValue(changed as never);
    vi.mocked(api.getFileDiff).mockResolvedValue("@@ -1 +1 @@\n+novo\n");
    render(<ChangesPanel cwd={"C:\\projeto"} version={0} />);

    const item = await screen.findByRole("button", { name: /^src\/a\.ts/ });
    fireEvent.click(item);
    expect(await screen.findByLabelText("Diff de src/a.ts")).toBeTruthy();

    fireEvent.click(item);
    await waitFor(() => expect(screen.queryByLabelText(/Diff de/)).toBeNull());
    expect(item.getAttribute("aria-pressed")).toBe("false");
  });

  it("recarrega a lista quando a versão muda (fim de turno)", async () => {
    vi.mocked(api.getChanges).mockResolvedValue(changed as never);
    const { rerender } = render(<ChangesPanel cwd={"C:\\projeto"} version={0} />);
    await screen.findByText("src/a.ts");

    rerender(<ChangesPanel cwd={"C:\\projeto"} version={1} />);

    await waitFor(() => expect(api.getChanges).toHaveBeenCalledTimes(2));
  });
});

describe("ChangesPanel: desfazer", () => {
  it("pede confirmação antes de desfazer e depois chama o backend", async () => {
    vi.mocked(api.getChanges).mockResolvedValue(changed as never);
    vi.mocked(api.getFileDiff).mockResolvedValue("");
    render(<ChangesPanel cwd="/projeto" version={0} />);

    const undo = await screen.findByRole("button", { name: "Desfazer src/a.ts" });
    fireEvent.click(undo);
    expect(api.discardChange).not.toHaveBeenCalled();
    expect(undo.textContent).toBe("Confirmar");

    fireEvent.click(undo);
    await waitFor(() => expect(api.discardChange).toHaveBeenCalledWith("/projeto", "src/a.ts", "modified"));
  });

  it("ao abrir a aba de novo, relê o git (o agente pode ter mexido em arquivos sem fechar um turno)", async () => {
    vi.mocked(api.getChanges).mockResolvedValue(changed as never);
    const { rerender } = render(<ChangesPanel cwd={"/projeto"} version={0} active={false} />);
    expect(api.getChanges).not.toHaveBeenCalled();

    rerender(<ChangesPanel cwd={"/projeto"} version={0} active />);

    expect(await screen.findByText("src/a.ts")).toBeTruthy();
    expect(api.getChanges).toHaveBeenCalledTimes(1);
  });

  it("ao voltar para a janela com a aba aberta, relê o git", async () => {
    vi.mocked(api.getChanges).mockResolvedValue(changed as never);
    render(<ChangesPanel cwd={"/projeto"} version={0} active />);
    await screen.findByText("src/a.ts");

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(api.getChanges).toHaveBeenCalledTimes(2));
  });

  it("uma falha ao ler o git aparece como alerta visível", async () => {
    vi.mocked(api.getChanges).mockRejectedValue("git não encontrado no PATH.");
    render(<ChangesPanel cwd={"/projeto"} version={0} active />);

    expect((await screen.findByRole("alert")).textContent).toContain("git não encontrado");
  });
});
