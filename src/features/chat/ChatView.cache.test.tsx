import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { responseCache } from "../../chat/responseCache";
import type { PluginHost } from "../../plugins/host";
import type { ProviderEvent } from "../../types";
import { ChatView } from "./ChatView";
import { getChanges, sendPrompt } from "../../api";

const bridge = vi.hoisted(() => ({
  emit: null as null | ((event: ProviderEvent) => void),
}));

// O plugin de cache liga o cache ao ser carregado, como o Cache de Tokens faz.
vi.mock("../../plugins/loader", () => ({
  loadInstalledPlugins: vi.fn(async (host: PluginHost) => {
    await host.load(
      { id: "cache-tokens", name: "Cache de Tokens", version: "0.1.0", entry: "index.js", permissions: ["cache"] },
      async () => ({ activate: (api) => api.cache.setEnabled(true) }),
    );
  }),
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
  PROFILES_CHANGED: "luna:profiles-changed",
  getChanges: vi.fn(async () => ({ isRepo: true, files: [] })),
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

/// Envia um pedido e termina a resposta com o texto dado.
async function askAndAnswer(text: string, answer: string) {
  await waitFor(() => expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).disabled).toBe(false));
  await waitFor(() => expect(responseCache.enabled).toBe(true));
  fireEvent.change(screen.getByLabelText("Mensagem"), { target: { value: text } });
  fireEvent.click(screen.getByLabelText("Enviar"));
  await waitFor(() => expect(screen.getByLabelText("Parar")).toBeTruthy());
  act(() => bridge.emit!({ kind: "textDelta", text: answer }));
  act(() => bridge.emit!({ kind: "done", ok: true }));
  await waitFor(() => expect(screen.queryByLabelText("Parar")).toBeNull());
  // Dá tempo para o turno terminar de guardar (ou não) a resposta.
  await act(async () => {});
}

describe("cache de respostas no chat", () => {
  beforeEach(() => {
    responseCache.clear();
    responseCache.setEnabled(false);
    vi.mocked(sendPrompt).mockClear();
    vi.mocked(getChanges).mockResolvedValue({ isRepo: true, files: [] });
  });

  it("uma nova conversa com o mesmo pedido usa a resposta guardada, sem chamar o provedor", async () => {
    const first = render(<ChatView onPersist={() => {}} />);
    await askAndAnswer("qual a capital?", "Brasília");
    first.unmount();

    render(<ChatView onPersist={() => {}} />);
    await waitFor(() => expect(responseCache.enabled).toBe(true));
    fireEvent.change(screen.getByLabelText("Mensagem"), { target: { value: "qual a capital?" } });
    fireEvent.click(screen.getByLabelText("Enviar"));

    // Acerto: a resposta guardada entra direto, sem turno em andamento (não há botão Parar).
    expect(await screen.findByText("Brasília")).toBeTruthy();
    expect(screen.getByText("do cache")).toBeTruthy();
    expect(sendPrompt).toHaveBeenCalledTimes(1);
  });

  it("uma resposta com alteração de arquivos não é guardada", async () => {
    vi.mocked(getChanges).mockResolvedValue({
      isRepo: true,
      files: [{ path: "a.ts", status: "modified", additions: 1, deletions: 0 }],
    });
    const first = render(<ChatView onPersist={() => {}} />);
    await askAndAnswer("qual a capital?", "Brasília");
    first.unmount();

    render(<ChatView onPersist={() => {}} />);
    await askAndAnswer("qual a capital?", "Brasília de novo");

    expect(sendPrompt).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("do cache")).toBeNull();
  });

  it("o mesmo pedido dentro de uma conversa com histórico vai ao provedor", async () => {
    render(<ChatView onPersist={() => {}} />);
    await askAndAnswer("oi", "olá");
    await askAndAnswer("oi", "olá de novo");

    expect(sendPrompt).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("do cache")).toBeNull();
  });
});
