import { act, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PluginHost } from "../../plugins/host";
import { ChatView } from "./ChatView";

// O main.tsx roda em StrictMode, que executa os efeitos duas vezes no desenvolvimento.
// O carregamento de plugins não pode registrar o mesmo modo duas vezes por causa disso.
vi.mock("../../plugins/loader", () => ({
  loadInstalledPlugins: vi.fn(async (host: PluginHost) => {
    await host.load(
      { id: "ask-mode", name: "Ask", version: "1.0.0", entry: "index.js", permissions: ["modes"] },
      async () => ({
        activate: (api) =>
          api.registerMode({
            id: "ask",
            label: "Perguntar",
            description: "Pergunta antes de alterar.",
            instruction: "Pergunte antes.",
            permission: "readOnly",
          }),
      }),
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
  onProviderEvent: vi.fn(async () => () => {}),
}));

import { loadInstalledPlugins } from "../../plugins/loader";

describe("ChatView em StrictMode", () => {
  it("carrega os plugins uma vez e não mostra modo repetido", async () => {
    render(
      <StrictMode>
        <ChatView onPersist={() => {}} />
      </StrictMode>,
    );
    await waitFor(() => expect(loadInstalledPlugins).toHaveBeenCalled());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(loadInstalledPlugins).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/já existe/)).toBeNull();
  });
});
