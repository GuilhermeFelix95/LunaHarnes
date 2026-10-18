import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuestionPicker } from "./QuestionPicker";

const QUESTIONS = [
  { question: "Qual banco?", options: ["Postgres", "SQLite"], multiple: false },
  { question: "Quais recursos?", options: ["Login", "Busca"], multiple: true },
];

describe("QuestionPicker", () => {
  it("mostra uma pergunta por vez, e escolha única avança sozinha", () => {
    render(<QuestionPicker questions={QUESTIONS} onAnswer={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByText("1 de 2")).toBeTruthy();
    expect(screen.queryByText("Quais recursos?")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Postgres" }));

    expect(screen.getByText("2 de 2")).toBeTruthy();
    expect(screen.getByText("Quais recursos?")).toBeTruthy();
    expect(screen.queryByText("Qual banco?")).toBeNull();
  });

  it("na última pergunta, o envio só libera com resposta", () => {
    render(<QuestionPicker questions={QUESTIONS} onAnswer={vi.fn()} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Postgres" }));

    const next = screen.getByRole("button", { name: "Enviar respostas" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(next.disabled).toBe(false);
  });

  it("envia tudo junto só na última pergunta", () => {
    const onAnswer = vi.fn();
    render(<QuestionPicker questions={QUESTIONS} onAnswer={onAnswer} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Postgres" }));
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    fireEvent.click(screen.getByRole("button", { name: "Busca" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));

    expect(onAnswer).toHaveBeenCalledWith("Qual banco?: Postgres\nQuais recursos?: Login, Busca");
  });

  it("\"Outra resposta\" conta como resposta e avança com Próxima", () => {
    const onAnswer = vi.fn();
    render(<QuestionPicker questions={QUESTIONS} onAnswer={onAnswer} onDismiss={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Outra resposta: Qual banco?"), { target: { value: " MySQL " } });
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));

    expect(onAnswer).toHaveBeenCalledWith("Qual banco?: MySQL\nQuais recursos?: Login");
  });

  it("Voltar retorna à pergunta anterior sem perder a resposta", () => {
    render(<QuestionPicker questions={QUESTIONS} onAnswer={vi.fn()} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "SQLite" }));

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.getByText("1 de 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "SQLite" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("marca a opção recomendada no seletor", () => {
    const withRecommended = [{ question: "Banco?", options: ["SQLite", "Postgres"], multiple: false, recommended: "SQLite" }];
    render(<QuestionPicker questions={withRecommended} onAnswer={vi.fn()} onDismiss={vi.fn()} />);

    const sqlite = screen.getByRole("button", { name: /SQLite/ });
    expect(sqlite.textContent).toContain("Recomendada");
    expect(screen.getByRole("button", { name: /Postgres/ }).textContent).not.toContain("Recomendada");
  });

  it("o X fecha o seletor sem enviar nada", () => {
    const onAnswer = vi.fn();
    const onDismiss = vi.fn();
    render(<QuestionPicker questions={QUESTIONS} onAnswer={onAnswer} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Fechar perguntas" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
