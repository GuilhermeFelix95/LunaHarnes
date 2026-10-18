import { describe, expect, it } from "vitest";
import { extractQuestions } from "./questions";

const BLOCK = [
  "Antes de começar, preciso saber:",
  "",
  "```luna-perguntas",
  '[{"pergunta": "Qual banco?", "opcoes": ["Postgres", "SQLite"], "multipla": false},',
  ' {"pergunta": "Quais recursos?", "opcoes": ["Login", "Busca", "Exportar"], "multipla": true}]',
  "```",
].join("\n");

describe("extractQuestions", () => {
  it("tira o bloco do texto e devolve as perguntas", () => {
    const parts = extractQuestions(BLOCK);

    expect(parts.text).toBe("Antes de começar, preciso saber:");
    expect(parts.questions).toEqual([
      { question: "Qual banco?", options: ["Postgres", "SQLite"], multiple: false },
      { question: "Quais recursos?", options: ["Login", "Busca", "Exportar"], multiple: true },
    ]);
    expect(parts.warning).toBeUndefined();
  });

  it("sem bloco, a resposta fica como está", () => {
    const parts = extractQuestions("Plano pronto: criar a tela.");

    expect(parts).toEqual({ text: "Plano pronto: criar a tela.", questions: null });
  });

  it("JSON inválido não quebra a conversa: mostra o texto e avisa", () => {
    const broken = "Pergunta:\n```luna-perguntas\n[{pergunta: sem aspas}]\n```";

    const parts = extractQuestions(broken);

    expect(parts.questions).toBeNull();
    expect(parts.text).toBe(broken);
    expect(parts.warning).toContain("formato inválido");
  });

  it("pergunta com menos de 2 opções é recusada", () => {
    const parts = extractQuestions('```luna-perguntas\n[{"pergunta": "Oi?", "opcoes": ["Sim"], "multipla": false}]\n```');

    expect(parts.questions).toBeNull();
    expect(parts.warning).toBeDefined();
  });

  it("mais de 6 opções também é recusado", () => {
    const options = JSON.stringify(["a", "b", "c", "d", "e", "f", "g"]);
    const parts = extractQuestions('```luna-perguntas\n[{"pergunta": "Letra?", "opcoes": ' + options + "}]\n```");

    expect(parts.questions).toBeNull();
  });

  it("multipla ausente vale false", () => {
    const parts = extractQuestions('```luna-perguntas\n[{"pergunta": "Cor?", "opcoes": ["Azul", "Verde"]}]\n```');

    expect(parts.questions?.[0].multiple).toBe(false);
  });
});
