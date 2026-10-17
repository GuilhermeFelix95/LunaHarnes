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
  fireEvent.click(screen.getByText("Enviar"));
  await waitFor(() => expect(screen.getByText("Parar")).toBeTruthy());
}

describe("ChatView: continuidade e envio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envia o sessionId da primeira resposta na segunda mensagem", async () => {
    render(<ChatView />);
    await waitFor(() => expect(screen.getByLabelText("Mensagem")).toBeTruthy());
    await waitFor(() => expect((screen.getByText("Enviar") as HTMLButtonElement).disabled).toBe(true));

    await send("primeira");
    emit({ kind: "sessionStarted", sessionId: "sess-1" });
    emit({ kind: "textDelta", text: "resposta" });
    emit({ kind: "done", ok: true });
    await waitFor(() => expect(screen.getByText("Enviar")).toBeTruthy());

    await send("segunda");

    const first = vi.mocked(api.sendPrompt).mock.calls[0][0];
    const second = vi.mocked(api.sendPrompt).mock.calls[1][0];
    expect(first.sessionId).toBeUndefined();
    expect(second.sessionId).toBe("sess-1");
    expect(second.cwd).toBe("C:\\projeto");
    expect(second.permission).toBe("acceptEdits");
  });
});
