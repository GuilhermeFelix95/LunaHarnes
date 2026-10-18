import { describe, expect, it } from "vitest";
import { extractPluginOffer, folderName } from "./pluginOffer";

describe("extractPluginOffer", () => {
  it("tira o bloco do texto e devolve a pasta", () => {
    const reply = 'Criei o plugin.\n```luna-plugin\n{"pasta": "C:\\\\dados\\\\plugin-drafts\\\\contador"}\n```\nClique em Instalar.';

    expect(extractPluginOffer(reply)).toEqual({
      text: "Criei o plugin.\n\nClique em Instalar.",
      folder: "C:\\dados\\plugin-drafts\\contador",
    });
  });

  it("resposta sem bloco fica como está", () => {
    expect(extractPluginOffer("Oi, tudo bem?")).toBeNull();
  });

  it("JSON inválido ou sem pasta não vira cartão", () => {
    expect(extractPluginOffer("```luna-plugin\n{pasta: sem aspas}\n```")).toBeNull();
    expect(extractPluginOffer('```luna-plugin\n{"outra": "x"}\n```')).toBeNull();
    expect(extractPluginOffer('```luna-plugin\n{"pasta": "  "}\n```')).toBeNull();
  });
});

describe("folderName", () => {
  it("mostra só o último trecho, com barra normal ou invertida", () => {
    expect(folderName("C:\\dados\\plugin-drafts\\contador")).toBe("contador");
    expect(folderName("/home/ana/plugin-drafts/contador/")).toBe("contador");
  });
});
