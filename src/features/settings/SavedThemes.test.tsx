import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PALETTE } from "../../theme";
import { SAVED_THEMES_KEY } from "../../themeShare";
import { SavedThemes } from "./SavedThemes";

describe("SavedThemes", () => {
  afterEach(() => localStorage.removeItem(SAVED_THEMES_KEY));

  it("salva a paleta atual com o nome dado", () => {
    render(<SavedThemes palette={DEFAULT_PALETTE} onApply={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Nome do tema"), { target: { value: "Noite azul" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar tema atual" }));

    expect(screen.getByRole("button", { name: "Aplicar Noite azul" })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(SAVED_THEMES_KEY)!)[0].name).toBe("Noite azul");
  });

  it("não salva sem nome", () => {
    render(<SavedThemes palette={DEFAULT_PALETTE} onApply={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Salvar tema atual" }));

    expect(screen.getByRole("alert").textContent).toContain("Dê um nome");
    expect(localStorage.getItem(SAVED_THEMES_KEY)).toBeNull();
  });

  it("aplicar devolve as cores do tema salvo", () => {
    const onApply = vi.fn();
    localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify([{ name: "Mar", palette: { ...DEFAULT_PALETTE, accent: "#2a9d8f" } }]));
    render(<SavedThemes palette={DEFAULT_PALETTE} onApply={onApply} />);

    fireEvent.click(screen.getByRole("button", { name: "Aplicar Mar" }));

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ accent: "#2a9d8f" }));
  });

  it("o código compartilhado importa de volta o mesmo tema", () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify([{ name: "Mar", palette: { ...DEFAULT_PALETTE, accent: "#2a9d8f" } }]));
    render(<SavedThemes palette={DEFAULT_PALETTE} onApply={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Compartilhar Mar" }));
    const code = (screen.getByLabelText("Código do tema") as HTMLTextAreaElement).value;
    fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));
    expect(writeText).toHaveBeenCalledWith(code);

    // Outra pessoa cola o código e importa.
    localStorage.removeItem(SAVED_THEMES_KEY);
    fireEvent.change(screen.getByLabelText("Código para importar"), { target: { value: code } });
    fireEvent.click(screen.getByRole("button", { name: "Importar tema" }));

    expect(screen.getByRole("button", { name: "Aplicar Mar" })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(SAVED_THEMES_KEY)!)[0].palette.accent).toBe("#2a9d8f");
  });

  it("código que não é tema mostra erro e não importa nada", () => {
    render(<SavedThemes palette={DEFAULT_PALETTE} onApply={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Código para importar"), { target: { value: "isso não é um tema" } });
    fireEvent.click(screen.getByRole("button", { name: "Importar tema" }));

    expect(screen.getByRole("alert").textContent).toContain("não é um tema");
    expect(localStorage.getItem(SAVED_THEMES_KEY)).toBeNull();
  });
});
