import { describe, expect, it } from "vitest";
import { cliPrompt, filterSlash, LUNA_COMMANDS, ORIGIN_LABELS, parseLunaCommand, slashQuery, type SlashItem } from "./slash";

const CLI: SlashItem[] = [
  { name: "pdf", description: "Lê PDFs", origin: "skill" },
  { name: "resumo", description: "Resume", origin: "command" },
];

describe("menu de /", () => {
  it("abre só enquanto o trecho depois da barra não tem espaço", () => {
    expect(slashQuery("/pl")).toBe("pl");
    expect(slashQuery("/")).toBe("");
    expect(slashQuery("/plano ")).toBeNull();
    expect(slashQuery("oi /pl")).toBeNull();
  });

  it("filtra pelo trecho, com os que começam com ele primeiro", () => {
    const items = [...LUNA_COMMANDS, ...CLI];

    expect(filterSlash(items, "pl").map((i) => i.name)).toEqual(["plano", "plugin instalar"]);
    expect(filterSlash(items, "xyz").map((i) => i.name)).toEqual([]);
    expect(filterSlash(items, "su").map((i) => i.name)).toEqual(["subagente", "resumo"]);
    expect(filterSlash([...CLI], "re").map((i) => i.name)).toEqual(["resumo"]);
  });
});

describe("comandos da Luna", () => {
  it("reconhece /projeto, que só confere os arquivos", () => {
    expect(parseLunaCommand("/projeto")).toEqual({ id: "projeto" });
    expect(LUNA_COMMANDS.map((i) => i.name)).toContain("projeto");
  });

  it("reconhece /plano e /plugin instalar com a pasta", () => {
    expect(parseLunaCommand("/plano")).toEqual({ id: "plano" });
    expect(parseLunaCommand("/plugin instalar  C:\\planos\\meu ")).toEqual({ id: "plugin", folder: "C:\\planos\\meu" });
  });

  it("reconhece /meta com a condição, e exige a condição", () => {
    expect(LUNA_COMMANDS.map((i) => i.name)).toContain("meta");
    expect(parseLunaCommand("/meta todos os testes passam")).toEqual({ id: "meta", condition: "todos os testes passam" });
    expect(parseLunaCommand("/meta")).toBeNull();
  });

  it("reconhece /subagente com a tarefa, e exige a tarefa", () => {
    expect(LUNA_COMMANDS.map((i) => i.name)).toContain("subagente");
    expect(parseLunaCommand("/subagente revisar os testes")).toEqual({ id: "subagente", task: "revisar os testes" });
    expect(parseLunaCommand("/subagente")).toBeNull();
  });

  it("outras entradas não são comando da Luna", () => {
    expect(parseLunaCommand("/plugin instalar")).toBeNull();
    expect(parseLunaCommand("/planejar")).toBeNull();
    expect(parseLunaCommand("oi")).toBeNull();
  });
});

describe("skills e comandos da CLI", () => {
  it("skill vai como pedido em linguagem natural, com os argumentos", () => {
    expect(cliPrompt("/pdf relatorio.pdf", CLI)).toBe("Use a skill pdf: relatorio.pdf");
    expect(cliPrompt("/pdf", CLI)).toBe("Use a skill pdf");
  });

  it("comando vai com a barra e os argumentos", () => {
    expect(cliPrompt("/resumo semana", CLI)).toBe("/resumo semana");
  });

  it("texto que não é skill nem comando segue como está", () => {
    expect(cliPrompt("/pdfx", CLI)).toBeNull();
    expect(cliPrompt("oi", CLI)).toBeNull();
  });
});

describe("plugins do Claude no menu", () => {
  const PLUGIN: SlashItem[] = [
    { name: "feature-dev:pdf", description: "Lê PDFs", origin: "claude-skill" },
    { name: "feature-dev:resumo", description: "Resume", origin: "claude-command" },
  ];

  it("têm rótulo próprio, diferente dos plugins da Luna e das skills locais", () => {
    expect(ORIGIN_LABELS["claude-skill"]).toBe("Skill do Claude");
    expect(ORIGIN_LABELS["claude-command"]).toBe("Comando do Claude");
    expect(ORIGIN_LABELS["claude-skill"]).not.toBe(ORIGIN_LABELS.plugin);
    expect(ORIGIN_LABELS["claude-skill"]).not.toBe(ORIGIN_LABELS.skill);
  });

  it("skill do plugin vai como pedido em linguagem natural, comando com a barra", () => {
    expect(cliPrompt("/feature-dev:pdf relatorio", PLUGIN)).toBe("Use a skill feature-dev:pdf: relatorio");
    expect(cliPrompt("/feature-dev:resumo semana", PLUGIN)).toBe("/feature-dev:resumo semana");
  });
});
