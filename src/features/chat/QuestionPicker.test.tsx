import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuestionPicker } from "./QuestionPicker";

const QUESTIONS = [
  { question: "Qual banco?", options: ["Postgres", "SQLite"], multiple: false },
  { question: "Quais recursos?", options: ["Login", "Busca"], multiple: true },
];

describe("QuestionPicker", () => {
  it("só envia quando todas as perguntas têm resposta", () => {
    const onAnswer = vi.fn();
    render(<QuestionPicker questions={QUESTIONS} onAnswer={onAnswer} />);

    const send = screen.getByRole("button", { name: "Enviar respostas" });
    expect((send as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Postgres" }));
    expect((send as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    fireEvent.click(screen.getByRole("button", { name: "Busca" }));
    expect((send as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(send);
    expect(onAnswer).toHaveBeenCalledWith("Qual banco?: Postgres\nQuais recursos?: Login, Busca");
  });

  it("pergunta de escolha única troca a opção marcada", () => {
    render(<QuestionPicker questions={QUESTIONS} onAnswer={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Postgres" }));
    fireEvent.click(screen.getByRole("button", { name: "SQLite" }));

    expect(screen.getByRole("button", { name: "Postgres" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "SQLite" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("\"Outra resposta\" conta como resposta e entra no envio", () => {
    const onAnswer = vi.fn();
    render(<QuestionPicker questions={QUESTIONS} onAnswer={onAnswer} />);

    fireEvent.change(screen.getByLabelText("Outra resposta: Qual banco?"), { target: { value: " MySQL " } });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));

    expect(onAnswer).toHaveBeenCalledWith("Qual banco?: MySQL\nQuais recursos?: Login");
  });
});
