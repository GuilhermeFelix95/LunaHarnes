import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPalette,
  applyTheme,
  CUSTOM_KEY,
  DEFAULT_PALETTE,
  loadCustomPalette,
  loadTheme,
  saveCustomPalette,
  saveTheme,
  THEME_KEY,
  SHAPES,
  THEMES,
  type ThemePalette,
} from "./theme";

const CUSTOM: ThemePalette = { ...DEFAULT_PALETTE, accent: "#40a0ff" };

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("style");
  });

  it("tem 12 temas de fábrica, na ordem, e o personalizado no fim", () => {
    expect(THEMES.map((t) => t.id)).toEqual([
      "luna", "claude", "codex", "terminal", "pixel", "meia-noite", "floresta", "por-do-sol", "cereja", "neon", "lavanda", "areia", "custom",
    ]);
  });

  it("o tamanho do texto multiplica a escala de tipo", () => {
    applyPalette({ ...DEFAULT_PALETTE, textSize: "large" });
    expect(document.documentElement.style.getPropertyValue("--text-md")).toBe("15.7px");

    applyPalette({ ...DEFAULT_PALETTE, textSize: "small" });
    expect(document.documentElement.style.getPropertyValue("--text-md")).toBe("12.9px");
  });

  it("sem vidro, os painéis usam a superfície plana", () => {
    applyPalette({ ...DEFAULT_PALETTE, glass: false });
    expect(document.documentElement.style.getPropertyValue("--glass")).toBe("var(--surface)");

    applyPalette({ ...DEFAULT_PALETTE, glass: true });
    expect(document.documentElement.style.getPropertyValue("--glass")).toContain("transparent");
  });

  it("balão e composer podem ter formato próprio, ou seguir o geral", () => {
    applyPalette({ ...DEFAULT_PALETTE, shape: "square", bubbleShape: "round", composerShape: null });
    expect(document.documentElement.style.getPropertyValue("--bubble-radius")).toBe("18px");
    expect(document.documentElement.style.getPropertyValue("--composer-radius")).toBe("6px");
  });

  it("botões, chips, itens e código têm formato próprio, ou seguem o geral", () => {
    applyPalette({ ...DEFAULT_PALETTE, shape: "soft", buttonShape: "square", chipShape: null, itemShape: "bubbly", codeShape: "round" });
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--button-radius")).toBe("3px");
    expect(style.getPropertyValue("--chip-radius")).toBe("999px");
    expect(style.getPropertyValue("--item-radius")).toBe("18px");
    expect(style.getPropertyValue("--code-radius")).toBe("14px");
  });

  it("há dez formatos de componente, e os assimétricos viram cantos diferentes", () => {
    expect(Object.keys(SHAPES)).toHaveLength(10);
    applyPalette({ ...DEFAULT_PALETTE, shape: "leaf" });
    expect(document.documentElement.style.getPropertyValue("--radius-md")).toBe("0 12px");
  });

  it("as fontes novas viram a pilha certa", () => {
    applyPalette({ ...DEFAULT_PALETTE, font: "cascadia" });
    expect(document.documentElement.style.getPropertyValue("--font-sans")).toContain("Cascadia Code");
  });

  it("a cor do terminal vira o fundo do terminal embutido", () => {
    applyPalette({ ...DEFAULT_PALETTE, terminal: "#123456" });
    expect(document.documentElement.style.getPropertyValue("--terminal-bg")).toBe("#123456");
  });

  it("só os temas Claude usam o terracota; os demais não têm laranja", () => {
    for (const t of THEMES) {
      if (t.id.startsWith("claude")) continue;
      expect(t.palette.accent).not.toMatch(/^#(d9|b2|ae|f2)/i);
    }
    expect(THEMES.find((t) => t.id === "claude")?.palette.accent).toBe("#d97757");
  });

  it("sem escolha salva, usa o Luna", () => {
    expect(loadTheme()).toBe("luna");
  });

  it("tema removido salvo antes, como o Noite, volta para o Luna", () => {
    localStorage.setItem(THEME_KEY, "noite");
    expect(loadTheme()).toBe("luna");
    localStorage.setItem(THEME_KEY, "<script>");
    expect(loadTheme()).toBe("luna");
  });

  it("salva e carrega o tema escolhido", () => {
    saveTheme("terminal");
    expect(localStorage.getItem(THEME_KEY)).toBe("terminal");
    expect(loadTheme()).toBe("terminal");
  });

  it("aplica o tema no data-theme, nas variáveis e avisa quem desenha cores próprias", () => {
    const listener = vi.fn();
    window.addEventListener("luna:theme", listener);

    applyTheme("terminal");
    const style = document.documentElement.style;
    expect(document.documentElement.getAttribute("data-theme")).toBe("terminal");
    expect(style.getPropertyValue("--bg")).toBe("#051407");
    expect(style.getPropertyValue("--font-sans")).toContain("Consolas");
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("luna:theme", listener);
  });

  it("o formato escolhido vira os raios dos componentes", () => {
    applyPalette({ ...DEFAULT_PALETTE, shape: "square" });
    expect(document.documentElement.style.getPropertyValue("--radius-lg")).toBe("4px");

    applyPalette({ ...DEFAULT_PALETTE, shape: "bubbly" });
    expect(document.documentElement.style.getPropertyValue("--radius-lg")).toBe("22px");
  });

  it("a cor do texto do balão e a cor do texto valem para o tema", () => {
    applyPalette({ ...DEFAULT_PALETTE, bubbleText: "#ff0000", text: "#00ff00" });
    expect(document.documentElement.style.getPropertyValue("--user-fg")).toBe("#ff0000");
    expect(document.documentElement.style.getPropertyValue("--fg")).toBe("#00ff00");
  });

  it("personalizado sem cores salvas usa a paleta padrão", () => {
    expect(loadCustomPalette()).toEqual(DEFAULT_PALETTE);
  });

  it("paleta salva inválida volta para o padrão", () => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify({ sidebar: "azul", chat: "#000000", bubble: "#111111", accent: "#222222" }));
    expect(loadCustomPalette()).toEqual(DEFAULT_PALETTE);
  });

  it("paleta antiga, só com as quatro cores, ganha texto e fonte padrão", () => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify({ sidebar: "#101010", chat: "#202020", bubble: "#303030", accent: "#40a0ff" }));
    const loaded = loadCustomPalette();
    expect(loaded.chat).toBe("#202020");
    expect(loaded.font).toBe("inter");
    expect(loaded.shape).toBe("soft");
    expect(loaded.text).toMatch(/^#/);
  });

  it("alterar uma cor do personalizado troca na hora", () => {
    saveCustomPalette(CUSTOM);
    applyTheme("custom");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#40a0ff");

    applyPalette({ ...CUSTOM, accent: "#ff00aa" });
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#ff00aa");
  });

  it("trocar de tema troca todas as cores de uma vez", () => {
    applyTheme("pixel");
    applyTheme("codex");
    expect(document.documentElement.style.getPropertyValue("--bg")).toBe("#212121");
  });
});

describe("temas de fábrica: legibilidade", () => {
  /// Contraste WCAG entre duas cores #rrggbb.
  const contrast = (a: string, b: string) => {
    const lum = (hex: string) => {
      const [r, g, bl] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it("texto e balão passam AA (4,5:1) em cada tema de fábrica", () => {
    for (const t of THEMES.filter((x) => x.id !== "custom")) {
      const p = t.palette;
      expect(contrast(p.text, p.chat), `${t.id}: texto na conversa`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.bubbleText, p.bubble), `${t.id}: texto do balão`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("o terminal embutido é escuro nos temas de fábrica, exceto o Terminal verde", () => {
    for (const t of THEMES.filter((x) => x.id !== "custom" && x.id !== "terminal")) {
      expect(t.palette.terminal, t.id).toBe("#121315");
    }
  });
});
