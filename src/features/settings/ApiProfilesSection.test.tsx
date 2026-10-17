import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiProfilesSection } from "./ApiProfilesSection";

vi.mock("../../api", () => ({
  apiPresets: vi.fn(async () => []),
  apiProfileHasKey: vi.fn(async () => true),
  checkAuth: vi.fn(async () => true),
  deleteApiProfile: vi.fn(async () => {}),
  listApiProfiles: vi.fn(async () => []),
  PROFILES_CHANGED: "luna:profiles-changed",
  saveApiProfile: vi.fn(async () => ({})),
  setApiProfileKey: vi.fn(async () => {}),
  testApiProfile: vi.fn(async () => "ok"),
}));

import * as api from "../../api";

const openRouter = { preset: "openRouter", label: "OpenRouter", engine: "claude" as const, defaultBaseUrl: "https://openrouter.ai/api" };

describe("ApiProfilesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.apiPresets).mockResolvedValue([openRouter]);
  });

  it("salva o perfil sem a chave e manda a chave só para o cofre", async () => {
    vi.mocked(api.saveApiProfile).mockResolvedValueOnce({
      id: "p9",
      name: "Minha OR",
      preset: "openRouter",
      baseUrl: "",
      models: [],
      defaultModel: null,
    });
    render(<ApiProfilesSection />);
    await screen.findByRole("option", { name: /OpenRouter/ });

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Minha OR" } });
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "openRouter" } });
    fireEvent.change(screen.getByLabelText("Chave da API"), { target: { value: "sk-or-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar perfil" }));

    await waitFor(() => expect(api.setApiProfileKey).toHaveBeenCalledWith("p9", "sk-or-123"));
    const sent = vi.mocked(api.saveApiProfile).mock.calls[0][0];
    expect(sent).toMatchObject({ name: "Minha OR", preset: "openRouter" });
    expect(JSON.stringify(sent)).not.toContain("sk-or-123");
    expect((screen.getByLabelText("Chave da API") as HTMLInputElement).value).toBe("");
  });

  it("testar conexão mostra a resposta do modelo", async () => {
    vi.mocked(api.listApiProfiles).mockResolvedValueOnce([
      { id: "p1", name: "DeepSeek", preset: "openRouter", baseUrl: "", models: [], defaultModel: null },
    ]);
    render(<ApiProfilesSection />);

    fireEvent.click(await screen.findByRole("button", { name: "Testar conexão" }));

    expect(await screen.findByText("Resposta: ok")).toBeTruthy();
    expect(api.testApiProfile).toHaveBeenCalledWith("p1");
  });

  it("sem chave salva, o teste de conexão fica desligado", async () => {
    vi.mocked(api.listApiProfiles).mockResolvedValueOnce([
      { id: "p1", name: "Sem chave", preset: "openRouter", baseUrl: "", models: [], defaultModel: null },
    ]);
    vi.mocked(api.apiProfileHasKey).mockResolvedValueOnce(false);
    render(<ApiProfilesSection />);

    const button = await screen.findByRole("button", { name: "Testar conexão" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/sem chave/)).toBeTruthy();
  });
});
