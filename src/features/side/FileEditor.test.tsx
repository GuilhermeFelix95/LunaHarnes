import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTO_SAVE_KEY, FileEditor } from "./FileEditor";

vi.mock("../../api", () => ({
  readProjectFile: vi.fn(async () => "fn main() {}"),
  writeProjectFile: vi.fn(async () => undefined),
}));

import { readProjectFile, writeProjectFile } from "../../api";

async function renderEditor(onClose = vi.fn()) {
  render(<FileEditor cwd="/projeto" path="src/main.rs" onClose={onClose} />);
  return (await screen.findByRole("textbox", { name: "src/main.rs" })) as HTMLTextAreaElement;
}

describe("editor de arquivo no lugar do chat", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(readProjectFile).mockClear();
    vi.mocked(writeProjectFile).mockClear();
    vi.mocked(writeProjectFile).mockResolvedValue(undefined);
  });

  it("carrega o conteúdo do arquivo no campo de texto", async () => {
    const text = await renderEditor();

    expect(text.value).toBe("fn main() {}");
    expect(readProjectFile).toHaveBeenCalledWith("/projeto", "src/main.rs");
    expect(screen.getByText("Salvo")).toBeTruthy();
  });

  it("editar marca como não salvo e o botão Salvar grava o texto novo", async () => {
    const text = await renderEditor();
    const save = screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(text, { target: { value: "fn main() { }" } });
    expect(screen.getByText("Não salvo")).toBeTruthy();
    expect(save.disabled).toBe(false);

    fireEvent.click(save);

    await waitFor(() => expect(screen.getByText("Salvo")).toBeTruthy());
    expect(writeProjectFile).toHaveBeenCalledWith("/projeto", "src/main.rs", "fn main() { }");
  });

  it("Ctrl+S grava na hora, com o foco no texto", async () => {
    const text = await renderEditor();
    fireEvent.change(text, { target: { value: "novo" } });

    fireEvent.keyDown(text, { key: "s", ctrlKey: true });

    await waitFor(() => expect(writeProjectFile).toHaveBeenCalledWith("/projeto", "src/main.rs", "novo"));
  });

  it("falha ao salvar aparece como aviso e o texto continua não salvo", async () => {
    vi.mocked(writeProjectFile).mockRejectedValueOnce("disco cheio");
    const text = await renderEditor();
    fireEvent.change(text, { target: { value: "novo" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect((await screen.findByRole("alert")).textContent).toContain("disco cheio");
    expect(screen.getByText("Não salvo")).toBeTruthy();
    expect(text.value).toBe("novo");
  });

  it("auto-salvar vem desligado e, quando ligado, grava sozinho depois de uma pausa", async () => {
    const text = await renderEditor();
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(text, { target: { value: "sozinho" } });

    await waitFor(() => expect(writeProjectFile).toHaveBeenCalledWith("/projeto", "src/main.rs", "sozinho"), { timeout: 2000 });
    expect(localStorage.getItem(AUTO_SAVE_KEY)).toBe("on");
  });

  it("com auto-salvar desligado, uma alteração não grava sozinha", async () => {
    const text = await renderEditor();

    fireEvent.change(text, { target: { value: "sem salvar" } });
    await new Promise((resolve) => setTimeout(resolve, 900));

    expect(writeProjectFile).not.toHaveBeenCalled();
  });

  it("fechar com alterações não salvas pede confirmação, e cancelar fica no editor", async () => {
    const onClose = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const text = await renderEditor(onClose);
    fireEvent.change(text, { target: { value: "novo" } });

    fireEvent.click(screen.getByRole("button", { name: "Fechar arquivo" }));

    expect(confirm).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("fechar sem alterações volta ao chat direto", async () => {
    const onClose = vi.fn();
    await renderEditor(onClose);

    fireEvent.click(screen.getByRole("button", { name: "Fechar arquivo" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
