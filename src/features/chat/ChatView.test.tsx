import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderEvent } from "../../types";
import { ChatView } from "./ChatView";

// Substitui a ponte com o Rust: o teste controla quando os eventos do CLI chegam.
const bridge = vi.hoisted(() => ({
  emit: null as null | ((event: ProviderEvent) => void),
}));

vi.mock("../../api", () => ({
  checkAuth: vi.fn(async () => true),
  openLogin: vi.fn(async () => {}),
  cancelPrompt: vi.fn(async () => {}),
  checkpointTake: vi.fn(async () => null),
  checkpointPreview: vi.fn(async () => ({ removed: [], restored: [] })),
  checkpointRestore: vi.fn(async () => ({ removed: [], restored: [] })),
  sendPrompt: vi.fn(async () => {}),
  getWorkspace: vi.fn(async () => "C:\\projeto"),
  listModels: vi.fn(async () => []),
  apiPresets: vi.fn(async () => []),
  apiProfileHasKey: vi.fn(async () => true),
  listApiProfiles: vi.fn(async () => []),
  listFiles: vi.fn(async () => []),
  saveAttachment: vi.fn(async () => "C:\\anexos\\foto.png"),
  saveFileAttachment: vi.fn(async () => "C:\\anexos\\notas.md"),
  PROFILES_CHANGED: "luna:profiles-changed",
  getChanges: vi.fn(async () => ({ isRepo: false, files: [] })),
  getFileDiff: vi.fn(async () => ""),
  terminalOpen: vi.fn(async () => "term-1"),
  terminalWrite: vi.fn(async () => {}),
  terminalResize: vi.fn(async () => {}),
  terminalClose: vi.fn(async () => {}),
  onTerminalData: vi.fn(async () => () => {}),
  onTerminalExit: vi.fn(async () => () => {}),
  pickWorkspace: vi.fn(async () => null),
  listPlugins: vi.fn(async () => ({ plugins: [], errors: [] })),
  readPluginEntry: vi.fn(async () => ""),
  getPluginsState: vi.fn(async () => ({ disabled: [] })),
  PLUGINS_CHANGED: "luna:plugins-changed",
  onProviderEvent: vi.fn(async (_runId: string, handler: (event: ProviderEvent) => void) => {
    bridge.emit = handler;
    return () => {};
  }),
}));

import * as api from "../../api";

function emit(event: ProviderEvent) {
  act(() => bridge.emit!(event));
}

async function send(text: string) {
  fireEvent.change(screen.getByLabelText("Mensagem"), { target: { value: text } });
  fireEvent.click(screen.getByLabelText("Enviar"));
  await waitFor(() => expect(screen.getByLabelText("Parar")).toBeTruthy());
}

/// Abre o seletor de provedor e escolhe o agente pelo nome que ele mostra.
async function pickAgent(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "Provedor" }));
  fireEvent.click(await screen.findByRole("option", { name }));
}

describe("ChatView: continuidade e envio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sem escolha salva, começa pelo modelo marcado como padrão (o mais barato)", async () => {
    vi.mocked(api.listModels).mockResolvedValueOnce([
      { id: "claude-opus-5-5", label: "Opus 5.5", description: null, efforts: [], default: false },
      { id: "claude-haiku-5-5", label: "Haiku 5.5", description: null, efforts: [], default: true },
    ]);
    render(<ChatView onPersist={() => {}} />);

    expect(await screen.findByText("Haiku 5.5")).toBeTruthy();
  });

  it("conversa nova começa com o modo plano desligado, e só liga com o clique", async () => {
    render(<ChatView onPersist={() => {}} />);
    await waitFor(() => expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(false));

    expect(screen.getByLabelText("Modo de planejamento").getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByText(/Modo de planejamento/)).toBeNull();

    fireEvent.click(screen.getByLabelText("Modo de planejamento"));

    expect(screen.getByLabelText("Modo de planejamento").getAttribute("aria-pressed")).toBe("true");
    expect(await screen.findByText(/Modo de planejamento/)).toBeTruthy();
  });

  it("no modo plano, a resposta vai para a aba Plano do painel e abre a aba", async () => {
    render(<ChatView onPersist={() => {}} />);
    await waitFor(() => expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(false));
    fireEvent.click(screen.getByLabelText("Modo de planejamento"));

    await send("quero um app de tarefas");
    emit({ kind: "textDelta", text: "## Plano\n\nPasso 1: criar a tela." });
    emit({ kind: "done", ok: true });
    await waitFor(() => expect(screen.getByLabelText("Enviar")).toBeTruthy());

    expect(vi.mocked(api.sendPrompt).mock.calls[0][0].permission).toBe("readOnly");
    expect(screen.getByRole("tab", { name: "Plano" }).getAttribute("aria-selected")).toBe("true");
    expect(document.querySelector(".side__plan")?.textContent).toContain("Passo 1: criar a tela.");
  });

  it("no modo plano, uma resposta só com perguntas não vira plano", async () => {
    render(<ChatView onPersist={() => {}} />);
    await waitFor(() => expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(false));
    fireEvent.click(screen.getByLabelText("Modo de planejamento"));

    await send("quero um app de tarefas");
    emit({
      kind: "textDelta",
      text: 'Antes de planejar:\n```luna-perguntas\n[{"pergunta": "Qual banco?", "opcoes": ["Postgres", "SQLite"]}]\n```',
    });
    emit({ kind: "done", ok: true });
    await waitFor(() => expect(screen.getByLabelText("Enviar")).toBeTruthy());

    expect(screen.getByRole("tab", { name: "Plano" }).getAttribute("aria-selected")).toBe("false");
    expect(document.querySelector(".side__plan")?.textContent ?? "").not.toContain("Antes de planejar");
  });

  it("compactar pede o resumo e a próxima mensagem começa com ele, sem a sessão antiga", async () => {
    render(<ChatView onPersist={() => {}} />);
    await waitFor(() => expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(false));
    await send("primeira pergunta");
    emit({ kind: "textDelta", text: "Resposta antiga." });
    emit({ kind: "done", ok: true });
    await waitFor(() => expect(screen.getByRole("button", { name: "Compactar" }).hasAttribute("disabled")).toBe(false));

    fireEvent.click(screen.getByRole("button", { name: "Compactar" }));
    await waitFor(() => expect(vi.mocked(api.sendPrompt)).toHaveBeenCalledTimes(2));
    emit({ kind: "textDelta", text: "## Objetivo\nTela de login." });
    emit({ kind: "done", ok: true });
    await waitFor(() => expect(screen.getByText(/Conversa compactada/)).toBeTruthy());

    await send("continua");
    await waitFor(() => expect(vi.mocked(api.sendPrompt)).toHaveBeenCalledTimes(3));
    const next = vi.mocked(api.sendPrompt).mock.calls[2][0];
    expect(next.prompt).toContain("Esta conversa foi compactada");
    expect(next.prompt).toContain("Tela de login.");
    expect(next.sessionId).toBeUndefined();
  });

  it("no plano, o chat mostra só o resumo e o painel Plano mostra o plano completo", async () => {
    render(<ChatView onPersist={() => {}} />);
    await waitFor(() => expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(false));
    fireEvent.click(screen.getByLabelText("Modo de planejamento"));

    await send("quero um app de tarefas");
    emit({
      kind: "textDelta",
      text: "Resumo: criar a tela de tarefas.\n```luna-plano\n## Arquivos a alterar\n- src/App.tsx: monta a tela\n```\nPode aprovar?",
    });
    emit({ kind: "done", ok: true });

    await waitFor(() => expect(document.querySelector(".side__plan")?.textContent ?? "").toContain("src/App.tsx"));
    expect(screen.getByText(/Resumo: criar a tela/).textContent).not.toContain("src/App.tsx");
  });

  it("no modo plano, responder 'Aprovar e executar' pelo seletor desliga o plano e executa", async () => {
    render(<ChatView onPersist={() => {}} />);
    await waitFor(() => expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(false));
    fireEvent.click(screen.getByLabelText("Modo de planejamento"));

    await send("quero um app de tarefas");
    emit({
      kind: "textDelta",
      text: 'Posso começar?\n```luna-perguntas\n[{"pergunta": "Aprovar o plano?", "opcoes": ["Aprovar e executar", "Ainda não"]}]\n```',
    });
    emit({ kind: "done", ok: true });
    const picker = within(await screen.findByRole("region", { name: "Perguntas do agente" }));
    fireEvent.click(picker.getByRole("button", { name: "Aprovar e executar" }));
    fireEvent.click(picker.getByRole("button", { name: "Enviar respostas" }));

    await waitFor(() => expect(vi.mocked(api.sendPrompt)).toHaveBeenCalledTimes(2));
    const approval = vi.mocked(api.sendPrompt).mock.calls[1][0];
    expect(approval.prompt).toContain("execute o plano agora");
    expect(approval.permission).not.toBe("readOnly");
    expect(screen.getByLabelText("Modo de planejamento").getAttribute("aria-pressed")).toBe("false");
  });

  it("fora do modo Conversar, perguntas não viram seletor", async () => {
    render(<ChatView onPersist={() => {}} />);
    await waitFor(() => expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(false));
    await send("crie uma tela de login");
    emit({
      kind: "textDelta",
      text: 'Antes de começar:\n```luna-perguntas\n[{"pergunta": "Qual banco?", "opcoes": ["Postgres", "SQLite"]}]\n```',
    });
    emit({ kind: "done", ok: true });

    await waitFor(() => expect(screen.getByLabelText("Enviar")).toBeTruthy());
    expect(screen.queryByLabelText("Perguntas do agente")).toBeNull();
  });

  it("sugestões da tela vazia preenchem a caixa sem enviar", async () => {
    render(<ChatView onPersist={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "Encontre bugs" }));

    expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).value).toBe("Encontre bugs");
    expect(api.sendPrompt).not.toHaveBeenCalled();
  });

  it("perfil de API vira o agente: manda o id e o motor, e a resposta leva o nome do perfil", async () => {
    vi.mocked(api.apiPresets).mockResolvedValueOnce([
      { preset: "deepSeek", label: "DeepSeek", engine: "claude", defaultBaseUrl: "https://api.deepseek.com/anthropic", suggestedModels: [], defaultModel: "" },
    ]);
    vi.mocked(api.listApiProfiles).mockResolvedValueOnce([
      { id: "p1", name: "DeepSeek", preset: "deepSeek", baseUrl: "", models: ["deepseek-chat"], defaultModel: "deepseek-chat" },
    ]);
    render(<ChatView onPersist={() => {}} />);

    await screen.findByRole("button", { name: "Provedor" });
    await pickAgent("DeepSeek · via Claude Code");
    await waitFor(() => expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(false));

    await send("olá");
    emit({ kind: "textDelta", text: "oi" });
    emit({ kind: "done", ok: true });
    await waitFor(() => expect(screen.getByLabelText("Enviar")).toBeTruthy());

    const request = vi.mocked(api.sendPrompt).mock.calls[0][0];
    expect(request.profile).toBe("p1");
    expect(request.provider).toBe("claude");
    expect(document.querySelector(".message__author")?.textContent).toContain("DeepSeek · via Claude Code");
  });

  it("anexar um arquivo que não é imagem e enviar sem texto manda o caminho salvo no pedido", async () => {
    render(<ChatView onPersist={() => {}} />);
    await waitFor(() => expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(false));

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input!, { target: { files: [new File(["# notas"], "notas.md", { type: "text/markdown" })] } });
    await screen.findByText("notas.md");

    fireEvent.click(screen.getByLabelText("Enviar"));
    await waitFor(() => expect(api.sendPrompt).toHaveBeenCalledTimes(1));

    expect(api.saveFileAttachment).toHaveBeenCalledWith("notas.md", expect.any(String));
    const request = vi.mocked(api.sendPrompt).mock.calls[0][0];
    expect(request.prompt).toContain("C:\\anexos\\notas.md");
    expect(request.prompt).toContain("Veja os anexos.");
    expect(request.images ?? []).toHaveLength(0);
  });

  it("envia o sessionId da primeira resposta na segunda mensagem", async () => {
    render(<ChatView onPersist={() => {}} />);
    await waitFor(() => expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(false));

    await send("primeira");
    emit({ kind: "sessionStarted", sessionId: "sess-1" });
    emit({ kind: "textDelta", text: "resposta" });
    emit({ kind: "done", ok: true });
    await waitFor(() => expect(screen.getByLabelText("Enviar")).toBeTruthy());

    await send("segunda");

    const first = vi.mocked(api.sendPrompt).mock.calls[0][0];
    const second = vi.mocked(api.sendPrompt).mock.calls[1][0];
    expect(first.sessionId).toBeUndefined();
    expect(second.sessionId).toBe("sess-1");
    expect(second.cwd).toBe("C:\\projeto");
    expect(second.permission).toBe("acceptEdits");
  });

  it("troca de agente no meio da conversa sem perder contexto", async () => {
    render(<ChatView onPersist={() => {}} />);
    await waitFor(() => expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(false));

    await send("crie a landing page");
    emit({ kind: "sessionStarted", sessionId: "sess-claude" });
    emit({ kind: "textDelta", text: "Criei index.html." });
    emit({ kind: "done", ok: true });
    await waitFor(() => expect(screen.getByLabelText("Enviar")).toBeTruthy());

    // Claude → Codex: sessão nova com o histórico inteiro antes da mensagem.
    await pickAgent("Codex");
    await waitFor(() => expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(false));
    await send("agora ajuste o CSS");
    const toCodex = vi.mocked(api.sendPrompt).mock.calls[1][0];
    expect(toCodex.provider).toBe("codex");
    expect(toCodex.sessionId).toBeUndefined();
    expect(toCodex.prompt).toContain("crie a landing page");
    expect(toCodex.prompt).toContain("### Claude Code\nCriei index.html.");
    expect(toCodex.prompt).toMatch(/Nova mensagem do usuário:\nagora ajuste o CSS$/);
    expect(screen.getByText("Criei index.html.")).toBeTruthy();

    emit({ kind: "sessionStarted", sessionId: "sess-codex" });
    emit({ kind: "textDelta", text: "Ajustei o CSS." });
    emit({ kind: "done", ok: true });
    await waitFor(() => expect(screen.getByLabelText("Enviar")).toBeTruthy());

    // Codex → Claude: retoma a sessão antiga e recebe só o que perdeu.
    await pickAgent("Claude Code");
    await waitFor(() => expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(false));
    await send("revise tudo");
    const back = vi.mocked(api.sendPrompt).mock.calls[2][0];
    expect(back.sessionId).toBe("sess-claude");
    expect(back.prompt).toContain("### Codex\nAjustei o CSS.");
    expect(back.prompt).not.toContain("crie a landing page");
  });

  it("salva a conversa completa ao fim do turno, com o sessionId", async () => {
    const persist = vi.fn();
    render(<ChatView onPersist={persist} />);
    await waitFor(() => expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(false));

    await send("pergunta");
    emit({ kind: "sessionStarted", sessionId: "sess-9" });
    emit({ kind: "textDelta", text: "resposta final" });
    emit({ kind: "done", ok: true });

    await waitFor(() => expect(persist).toHaveBeenCalled());
    const saved = persist.mock.calls.at(-1)![0];
    expect(saved.sessionId).toBe("sess-9");
    expect(saved.title).toBe("pergunta");
    expect(saved.cwd).toBe("C:\\projeto");
    expect(saved.messages).toEqual([
      { role: "user", text: "pergunta", at: expect.any(Number) },
      { role: "assistant", text: "resposta final", provider: "claude", at: expect.any(Number) },
    ]);
    expect(saved.sessions).toEqual({ claude: { id: "sess-9", seen: 2 } });
  });
});
