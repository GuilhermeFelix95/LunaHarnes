import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Quebra(): never {
  throw new Error("falha de teste");
}

describe("ErrorBoundary", () => {
  it("mostra a tela de erro com recarregar em vez de deixar a janela em branco", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Quebra />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Algo deu errado")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recarregar" })).toBeTruthy();
    vi.restoreAllMocks();
  });

  it("sem erro, mostra o conteúdo normalmente", () => {
    render(
      <ErrorBoundary>
        <p>tudo certo</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("tudo certo")).toBeTruthy();
  });
});
