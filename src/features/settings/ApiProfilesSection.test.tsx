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
  refreshApiModels: vi.fn(async () => ({ ids: ["deepseek-flash", "deepseek-v4-pro"], cheapest: "deepseek-flash" })),
  listProviderModels: vi.fn(async () => ({ ids: [], cheapest: null })),
  saveApiProfile: vi.fn(async () => ({})),
  setApiProfileKey: vi.fn(async () => {}),
  testApiProfile: vi.fn(async () => "ok"),
}));

import * as api from "../../api";

const openRouter = { preset: "openRouter", label: "OpenRouter", engine: "claude" as const, defaultBaseUrl: "https://openrouter.ai/api", suggestedModels: [], defaultModel: "" };

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
    await screen.findByRole("radio", { name: /OpenRouter/ });

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Minha OR" } });
    fireEvent.click(screen.getByRole("radio", { name: /OpenRouter/ }));
    fireEvent.change(screen.getByLabelText("Chave da API"), { target: { value: "sk-or-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar perfil" }));

    await waitFor(() => expect(api.setApiProfileKey).toHaveBeenCalledWith("p9", "sk-or-123"));
    const sent = vi.mocked(api.saveApiProfile).mock.calls[0][0];
    expect(sent).toMatchObject({ name: "Minha OR", preset: "openRouter" });
    expect(JSON.stringify(sent)).not.toContain("sk-or-123");
    expect((screen.getByLabelText("Chave da API") as HTMLInputElement).value).toBe("");
  });

  it("escolher o provedor já preenche os modelos prontos, e só falta a chave", async () => {
    vi.mocked(api.apiPresets).mockResolvedValueOnce([
      { preset: "deepSeek", label: "DeepSeek", engine: "claude" as const, defaultBaseUrl: "https://api.deepseek.com/anthropic", suggestedModels: ["deepseek-flash", "deepseek-v4-pro"], defaultModel: "deepseek-flash" },
    ]);
    render(<ApiProfilesSection />);
    await screen.findByRole("radio", { name: /DeepSeek/ });

    fireEvent.click(screen.getByRole("radio", { name: /DeepSeek/ }));

    expect((screen.getByLabelText("Modelos (separados por vírgula)") as HTMLInputElement).value).toBe("deepseek-flash, deepseek-v4-pro");
    expect((screen.getByLabelText("Modelo padrão") as HTMLInputElement).value).toBe("deepseek-flash");
  });

  it("Atualizar lista usa a chave colada, mesmo antes de salvar o perfil", async () => {
    render(<ApiProfilesSection />);
    fireEvent.click(await screen.findByRole("radio", { name: /OpenRouter/ }));
    fireEvent.change(screen.getByLabelText("Chave da API"), { target: { value: "sk-or-teste-123" } });

    fireEvent.click(screen.getByRole("button", { name: "Atualizar lista de modelos" }));

    await waitFor(() =>
      expect(api.listProviderModels).toHaveBeenCalledWith("openRouter", "", "sk-or-teste-123"),
    );
  });

  it("ao colar a chave, a lista de modelos vem da API e o padrão é o mais barato", async () => {
    vi.mocked(api.listProviderModels).mockResolvedValueOnce({ ids: ["a/x:free", "b/y"], cheapest: "a/x:free" });
    render(<ApiProfilesSection />);
    fireEvent.click(await screen.findByRole("radio", { name: /OpenRouter/ }));
    fireEvent.change(screen.getByLabelText("Chave da API"), { target: { value: "sk-or-teste-123" } });

    await waitFor(() =>
      expect((screen.getByLabelText("Modelos (separados por vírgula)") as HTMLInputElement).value).toBe("a/x:free, b/y"),
    );
    expect((screen.getByLabelText("Modelo padrão") as HTMLInputElement).value).toBe("a/x:free");
  });

  it("Atualizar lista troca os modelos pelos que a API devolve", async () => {
    vi.mocked(api.listApiProfiles).mockResolvedValueOnce([
      { id: "p1", name: "DeepSeek", preset: "openRouter", baseUrl: "", models: ["velho"], defaultModel: null },
    ]);
    render(<ApiProfilesSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    await screen.findByDisplayValue("velho");

    fireEvent.click(screen.getByRole("button", { name: "Atualizar lista de modelos" }));

    await waitFor(() => expect(api.refreshApiModels).toHaveBeenCalledWith("p1"));
    expect((screen.getByLabelText("Modelos (separados por vírgula)") as HTMLInputElement).value).toBe(
      "deepseek-flash, deepseek-v4-pro",
    );
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
