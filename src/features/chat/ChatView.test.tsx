import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  sendPrompt: vi.fn(async () => {}),
  getWorkspace: vi.fn(async () => "C:\\projeto"),
  pickWorkspace: vi.fn(async () => null),
  listPlugins: vi.fn(async () => ({ plugins: [], errors: [] })),
  readPluginEntry: vi.fn(async () => ""),
  onProviderEvent: vi.fn(async (handler: (event: ProviderEvent) => void) => {
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

describe("ChatView: continuidade e envio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envia o sessionId da primeira resposta na segunda mensagem", async () => {
    render(<ChatView onPersist={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText("Mensagem")).toBeTruthy());
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
      { role: "user", text: "pergunta" },
      { role: "assistant", text: "resposta final" },
    ]);
  });
});
