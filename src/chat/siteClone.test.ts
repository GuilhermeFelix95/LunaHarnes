import { describe, expect, it } from "vitest";
import {
  buildClonePrompt,
  checkFolderName,
  CLONE_PARTS,
  CLONE_TARGET_FOLDER,
  CLONE_TARGET_PROJECT,
  cloneQuestions,
  parseCloneAnswer,
} from "./siteClone";

describe("resposta do seletor de destino e partes", () => {
  it("lê o destino e as partes escolhidas e ignora o que não é parte conhecida", () => {
    expect(parseCloneAnswer(`Onde o clone deve ficar?: ${CLONE_TARGET_PROJECT}\nO que você quer clonar deste site?: Cores, Componentes`)).toEqual({
      inProject: true,
      parts: ["Cores", "Componentes"],
    });
    expect(parseCloneAnswer(`Onde o clone deve ficar?: ${CLONE_TARGET_FOLDER}\nO que você quer clonar deste site?: Textos e imagens, texto livre`)).toEqual({
      inProject: false,
      parts: ["Textos e imagens"],
    });
    expect(parseCloneAnswer(`Onde o clone deve ficar?: ${CLONE_TARGET_FOLDER}\nO que você quer clonar deste site?: `)).toEqual({
      inProject: false,
      parts: [],
    });
  });
});

describe("perguntas do clonador", () => {
  it("pergunta primeiro o destino, com subpasta ou projeto atual", () => {
    const [target] = cloneQuestions();

    expect(cloneQuestions()).toHaveLength(2);
    expect(target.options).toEqual([CLONE_TARGET_FOLDER, CLONE_TARGET_PROJECT]);
    expect(target.multiple).toBeFalsy();
  });

  it("oferece as seis partes em seleção múltipla, com layout recomendado", () => {
    const [, question] = cloneQuestions();

    expect(question.options).toEqual([...CLONE_PARTS]);
    expect(question.options).toHaveLength(6);
    expect(question.multiple).toBe(true);
    expect(question.recommended).toBe("Layout e estrutura");
  });
});

describe("nome da pasta do clone", () => {
  it("aceita letras, números, espaço, hífen e sublinhado", () => {
    expect(checkFolderName("  Loja Nova_2-final ")).toEqual({ ok: true, name: "Loja Nova_2-final" });
    expect(checkFolderName("Clínica")).toEqual({ ok: true, name: "Clínica" });
  });

  it("recusa separador de caminho e sequência de subida de pasta", () => {
    for (const bad of ["../fora", "a/b", "a\\b", "..", ".", "C:x", "pasta.v2"]) {
      expect(checkFolderName(bad).ok, bad).toBe(false);
    }
  });

  it("recusa nome vazio e nome longo demais", () => {
    expect(checkFolderName("   ").ok).toBe(false);
    expect(checkFolderName("a".repeat(61)).ok).toBe(false);
    expect(checkFolderName("a".repeat(60)).ok).toBe(true);
  });
});

describe("pedido de recriação", () => {
  const capture = {
    title: "Loja Exemplo",
    colors: ["#ff0000", "#fff"],
    keyframes: 2,
    components: ["header", "button"],
    cssVariables: [] as string[],
    embeddedCss: "",
  };

  it("leva URL, pasta, partes escolhidas e o que foi capturado", () => {
    const prompt = buildClonePrompt({
      url: "https://exemplo.com/",
      folder: "Loja Nova",
      parts: ["Cores", "Componentes"],
      capture,
    });

    expect(prompt).toContain("https://exemplo.com/");
    expect(prompt).toContain("Loja Nova/");
    expect(prompt).toContain("Copie somente: Cores, Componentes.");
    expect(prompt).toContain("#ff0000 #fff");
    expect(prompt).toContain("header, button");
    expect(prompt).not.toContain("@keyframes");
  });

  it("não leva cores nem componentes que a pessoa não escolheu", () => {
    const prompt = buildClonePrompt({ url: "https://exemplo.com/", folder: "x", parts: ["Animações"], capture });

    expect(prompt).not.toContain("#ff0000");
    expect(prompt).not.toContain("header, button");
    expect(prompt).toContain("(@keyframes): 2.");
  });

  it("leva as variáveis de cor com as cores e o CSS resumido com o layout", () => {
    const full = { ...capture, cssVariables: ["--cor-primaria: #1a73e8"], embeddedCss: ".hero { display: grid; }" };
    const prompt = buildClonePrompt({ url: "https://exemplo.com/", folder: "x", parts: ["Cores", "Layout e estrutura"], capture: full });

    expect(prompt).toContain("Variáveis de cor do site: --cor-primaria: #1a73e8.");
    expect(prompt).toContain("CSS embutido na página (resumo): .hero { display: grid; }");
  });

  it("no projeto atual, não cria subpasta e pede componentes e regras no código existente", () => {
    const prompt = buildClonePrompt({ url: "https://exemplo.com/", folder: null, parts: ["Cores", "Componentes"], capture });

    expect(prompt).not.toContain("Salve o resultado na pasta");
    expect(prompt).toContain("código do projeto atual");
    expect(prompt).toContain("componentes");
    expect(prompt).toContain("regras de CSS");
    expect(prompt).toContain("#ff0000");
  });

  it("sem partes escolhidas, cai no layout", () => {
    const prompt = buildClonePrompt({ url: "https://exemplo.com/", folder: "x", parts: [], capture });

    expect(prompt).toContain("Copie somente: Layout e estrutura.");
  });
});
