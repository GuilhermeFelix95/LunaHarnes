import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";

const effort = (id: string, label: string, recommended = false) => ({ id, label, recommended });

const CLAUDE_MODELS = [
  {
    id: "claude-opus-5-5",
    label: "Opus 5.5",
    description: "Para trabalho complexo",
    efforts: [effort("low", "Low"), effort("medium", "Medium", true), effort("max", "Max")],
    default: false,
  },
  {
    id: "claude-sonnet-5-5",
    label: "Sonnet 5.5",
    description: "Mais eficiente",
    efforts: [effort("low", "Low"), effort("medium", "Medium", true)],
    default: false,
  },
];

function setup(overrides: Partial<Parameters<typeof Composer>[0]> = {}) {
  const props = {
    draft: "olá",
    onDraft: vi.fn(),
    onSend: vi.fn(),
    onStop: vi.fn(),
    running: false,
    blocked: false,
    agent: "claude",
    agents: [
      { key: "claude", label: "Claude Code", engine: "claude" as const },
      { key: "api:p1", label: "DeepSeek · via Claude Code", engine: "claude" as const, profileId: "p1" },
    ],
    onAgent: vi.fn(),
    permission: "acceptEdits" as const,
    onPermission: vi.fn(),
    models: CLAUDE_MODELS,
    model: "",
    onModel: vi.fn(),
    effort: "",
    onEffort: vi.fn(),
    planning: false,
    onTogglePlanning: vi.fn(),
    modes: [] as { id: string; label: string; description: string; instruction: string; permission: "readOnly" }[],
    mode: "",
    onMode: vi.fn(),
    ...overrides,
  };
  render(<Composer {...props} />);
  return props;
}

describe("Composer", () => {
  it("Enter envia a mensagem", () => {
    const props = setup();
    fireEvent.keyDown(screen.getByLabelText("Mensagem"), { key: "Enter" });

    expect(props.onSend).toHaveBeenCalledOnce();
  });

  it("Shift+Enter não envia (quebra de linha)", () => {
    const props = setup();
    fireEvent.keyDown(screen.getByLabelText("Mensagem"), { key: "Enter", shiftKey: true });

    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("Enter não envia texto vazio", () => {
    const props = setup({ draft: "   " });
    fireEvent.keyDown(screen.getByLabelText("Mensagem"), { key: "Enter" });

    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("durante a execução o botão vira Parar", () => {
    const props = setup({ running: true });
    fireEvent.click(screen.getByLabelText("Parar"));

    expect(props.onStop).toHaveBeenCalledOnce();
  });

  it("bloqueado (sem login) não aceita envio", () => {
    const props = setup({ blocked: true });
    fireEvent.keyDown(screen.getByLabelText("Mensagem"), { key: "Enter" });

    expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(true);
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("o provedor pode ser trocado no meio da conversa, só não durante uma resposta", () => {
    setup();
    expect((screen.getByRole("button", { name: "Provedor" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("o seletor lista os CLIs e os perfis de API, e avisa a escolha", () => {
    const onAgent = vi.fn();
    setup({ onAgent });

    fireEvent.click(screen.getByRole("button", { name: "Provedor" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Claude Code",
      "DeepSeek · via Claude Code",
    ]);
    fireEvent.click(screen.getByRole("option", { name: "DeepSeek · via Claude Code" }));
    expect(onAgent).toHaveBeenCalledWith("api:p1");
  });

  it("o seletor de esforço fica desligado enquanto nenhum modelo está escolhido", () => {
    setup({ model: "" });

    expect((screen.getByRole("button", { name: "Esforço" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("mostra só os níveis que o modelo escolhido aceita", () => {
    setup({ model: "claude-sonnet-5-5" });
    fireEvent.click(screen.getByRole("button", { name: "Esforço" }));

    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Padrão", "Low", "Medium (recomendado)"]);
  });

  it("marca o nível recomendado com o nome que o Desktop usa", () => {
    setup({ model: "claude-opus-5-5" });
    fireEvent.click(screen.getByRole("button", { name: "Esforço" }));

    expect(screen.getByRole("option", { name: "Medium (recomendado)" })).toBeTruthy();
  });

  it("escolher a permissão avisa o novo modo", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Permissão" }));
    fireEvent.click(screen.getByRole("option", { name: "Só leitura" }));

    expect(props.onPermission).toHaveBeenCalledWith("readOnly");
  });

  it("o seletor de modelo mostra o nome e a descrição de cada modelo", () => {
    setup();
    fireEvent.click(screen.getByLabelText("Modelo"));

    expect(screen.getByRole("option", { name: /Opus 5\.5/ })).toBeTruthy();
    expect(screen.getByText("Para trabalho complexo")).toBeTruthy();
    expect(screen.getByRole("option", { name: /Sonnet 5\.5/ })).toBeTruthy();
  });

  it("o seletor de modelo lista só os modelos suportados, sem 'Padrão da CLI'", () => {
    setup({ model: "claude-opus-5-5" });
    fireEvent.click(screen.getByLabelText("Modelo"));

    expect(screen.queryByText("Padrão da CLI")).toBeNull();
    const list = screen.getByRole("listbox", { name: "Modelos" });
    expect(within(list).getAllByRole("option")).toHaveLength(2);
  });

  it("escolher um modelo manda o ID da CLI, não o nome de exibição", () => {
    const props = setup();
    fireEvent.click(screen.getByLabelText("Modelo"));
    fireEvent.click(screen.getByRole("option", { name: /Opus 5\.5/ }));

    expect(props.onModel).toHaveBeenCalledWith("claude-opus-5-5");
  });

  it("o botão Planejar reflete o modo e alterna ao clicar", () => {
    const props = setup({ planning: true });
    const plan = screen.getByLabelText("Modo de planejamento");

    expect(plan.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(plan);
    expect(props.onTogglePlanning).toHaveBeenCalledOnce();
  });
});

describe("Composer: modos de plugin", () => {
  const ASK = { id: "ask", label: "Conversar", description: "Só explica", instruction: "Só explique.", permission: "readOnly" as const };

  it("liga um modo ao clicar no chip", () => {
    const props = setup({ modes: [ASK] });
    fireEvent.click(screen.getByRole("button", { name: "Conversar" }));

    expect(props.onMode).toHaveBeenCalledWith("ask");
  });

  it("desliga o modo ativo ao clicar de novo", () => {
    const props = setup({ modes: [ASK], mode: "ask" });
    const chip = screen.getByRole("button", { name: "Conversar" });
    expect(chip.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(chip);
    expect(props.onMode).toHaveBeenCalledWith("");
  });
});

describe("Composer: @arquivo e imagens", () => {
  it("escolher uma sugestão devolve o caminho do arquivo", () => {
    const props = setup({ files: ["src/Parser.ts"], onPickFile: vi.fn() });
    fireEvent.click(screen.getByRole("option", { name: "src/Parser.ts" }));

    expect(props.onPickFile).toHaveBeenCalledWith("src/Parser.ts");
  });

  it("tirar uma imagem anexada devolve o id dela", () => {
    const props = setup({ attachments: [{ id: 3, url: "blob:foto" }], onRemoveAttachment: vi.fn() });
    fireEvent.click(screen.getByRole("button", { name: "Tirar imagem" }));

    expect(props.onRemoveAttachment).toHaveBeenCalledWith(3);
  });
});
