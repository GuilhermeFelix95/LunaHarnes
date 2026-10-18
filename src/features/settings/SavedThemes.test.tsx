import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PALETTE } from "../../theme";
import { SavedThemes } from "./SavedThemes";

describe("SavedThemes: compartilhar e importar", () => {
  it("gera o código do tema ativo e copia", () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<SavedThemes active={{ name: "Mar", palette: { ...DEFAULT_PALETTE, accent: "#2a9d8f" } }} onImport={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Gerar código do tema atual" }));
    const code = (screen.getByLabelText("Código do tema") as HTMLTextAreaElement).value;
    fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));

    expect(code).toContain('"name":"Mar"');
    expect(writeText).toHaveBeenCalledWith(code);
  });

  it("sem tema ativo, não gera código", () => {
    render(<SavedThemes active={null} onImport={vi.fn()} />);

    expect((screen.getByRole("button", { name: "Gerar código do tema atual" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("importa um código válido entregando o tema para quem chama", () => {
    const onImport = vi.fn();
    const code = JSON.stringify({ lunaTheme: 1, name: "Mar", palette: { ...DEFAULT_PALETTE, accent: "#2a9d8f" } });
    render(<SavedThemes active={null} onImport={onImport} />);

    fireEvent.change(screen.getByLabelText("Código para importar"), { target: { value: code } });
    fireEvent.click(screen.getByRole("button", { name: "Importar tema" }));

    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ name: "Mar" }));
  });

  it("código que não é tema mostra erro e não importa nada", () => {
    const onImport = vi.fn();
    render(<SavedThemes active={null} onImport={onImport} />);

    fireEvent.change(screen.getByLabelText("Código para importar"), { target: { value: "isso não é um tema" } });
    fireEvent.click(screen.getByRole("button", { name: "Importar tema" }));

    expect(screen.getByRole("alert").textContent).toContain("não é um tema");
    expect(onImport).not.toHaveBeenCalled();
  });
});
