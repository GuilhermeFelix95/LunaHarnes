import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playwrightInstall, playwrightStatus } from "../../api";
import { BrowserSection } from "./BrowserSection";

vi.mock("../../api", () => ({
  playwrightStatus: vi.fn(async () => false),
  playwrightInstall: vi.fn(async () => {}),
}));

describe("Configurações > Navegador", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(playwrightStatus).mockResolvedValue(false);
  });

  it("guarda a escolha do Playwright para as próximas execuções", async () => {
    render(<BrowserSection />);

    fireEvent.click(screen.getByRole("radio", { name: "Playwright" }));

    expect(localStorage.getItem("luna.agentBrowser")).toBe("playwright");
  });

  it("com Playwright escolhido e sem Chromium, oferece instalar e pede confirmação antes", async () => {
    render(<BrowserSection />);
    fireEvent.click(screen.getByRole("radio", { name: "Playwright" }));

    fireEvent.click(await screen.findByRole("button", { name: "Instalar o Chromium" }));

    expect(playwrightInstall).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Instalar" }));
    await waitFor(() => expect(playwrightInstall).toHaveBeenCalledTimes(1));
  });

  it("com o embutido escolhido, não mostra instalação", async () => {
    render(<BrowserSection />);
    await waitFor(() => expect(playwrightStatus).toHaveBeenCalled());

    expect(screen.queryByRole("button", { name: "Instalar o Chromium" })).toBeNull();
  });
});
