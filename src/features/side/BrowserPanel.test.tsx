import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api";
import { BrowserPanel } from "./BrowserPanel";

// Substitui a ponte com o Rust: o teste só confere o que o painel pede.
vi.mock("../../api", () => ({
  browserShow: vi.fn(async () => {}),
  browserOpen: vi.fn(async () => {}),
  browserSetBounds: vi.fn(async () => {}),
  browserNavigate: vi.fn(async (url: string) => `https://${url}/`),
  browserHistory: vi.fn(async () => {}),
  browserReload: vi.fn(async () => {}),
  onBrowserOpened: vi.fn(async () => () => {}),
}));

const AREA = { x: 12, y: 40, width: 300, height: 500, left: 12, top: 40, right: 312, bottom: 540, toJSON: () => ({}) };

/// Botão pelo nome acessível; o jsdom não tem as asserções do jest-dom neste projeto.
function button(name: string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

function submit(text: string) {
  fireEvent.change(screen.getByLabelText("Endereço"), { target: { value: text } });
  fireEvent.submit(screen.getByLabelText("Endereço").closest("form")!);
}

describe("BrowserPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(AREA as DOMRect);
  });

  it("sem navegador aberto, explica o que fazer e não deixa voltar", async () => {
    vi.mocked(api.browserShow).mockRejectedValueOnce(new Error("o navegador ainda não foi aberto"));
    render(<BrowserPanel active />);

    await waitFor(() => expect(api.browserShow).toHaveBeenCalledWith(true));
    expect(screen.getByText(/Digite um endereço acima/)).toBeTruthy();
    expect(button("Voltar").disabled).toBe(true);
  });

  it("enviar um endereço abre a página sobre a área da aba", async () => {
    vi.mocked(api.browserShow).mockRejectedValueOnce(new Error("o navegador ainda não foi aberto"));
    render(<BrowserPanel active />);
    await waitFor(() => expect(api.browserShow).toHaveBeenCalledWith(true));

    submit("exemplo.com");

    await waitFor(() =>
      expect(api.browserOpen).toHaveBeenCalledWith("exemplo.com", { x: 12, y: 40, width: 300, height: 500 }),
    );
    expect(button("Voltar").disabled).toBe(false);
  });

  it("com a página aberta, um endereço novo navega em vez de abrir outra webview", async () => {
    render(<BrowserPanel active />);
    await waitFor(() => expect(button("Voltar").disabled).toBe(false));

    submit("outro.com");

    await waitFor(() => expect(api.browserNavigate).toHaveBeenCalledWith("outro.com"));
    expect(api.browserOpen).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Endereço") as HTMLInputElement).value).toBe("https://outro.com/");
  });

  it("ao sair da aba, a página some; ao voltar, aparece de novo", async () => {
    const { rerender } = render(<BrowserPanel active={false} />);
    await waitFor(() => expect(api.browserShow).toHaveBeenCalledWith(false));

    rerender(<BrowserPanel active />);
    await waitFor(() => expect(api.browserShow).toHaveBeenLastCalledWith(true));
  });

  it("um endereço recusado mostra o motivo para a pessoa", async () => {
    vi.mocked(api.browserShow).mockRejectedValueOnce(new Error("sem página"));
    vi.mocked(api.browserOpen).mockRejectedValueOnce(new Error("só http e https são permitidos, não \"file\""));
    render(<BrowserPanel active />);
    await waitFor(() => expect(api.browserShow).toHaveBeenCalledWith(true));

    submit("file:///C:/segredo.txt");

    expect((await screen.findByRole("alert")).textContent).toContain("só http e https são permitidos");
  });

  it("voltar e avançar pedem ao navegador o histórico certo", async () => {
    render(<BrowserPanel active />);
    await waitFor(() => expect(button("Voltar").disabled).toBe(false));

    fireEvent.click(button("Voltar"));
    fireEvent.click(button("Avançar"));

    expect(api.browserHistory).toHaveBeenNthCalledWith(1, "back");
    expect(api.browserHistory).toHaveBeenNthCalledWith(2, "forward");
  });

  it("página aberta pelo agente aparece no painel sem clique", async () => {
    let fire: (url: string) => void = () => {};
    vi.mocked(api.onBrowserOpened).mockImplementationOnce(async (handler) => {
      fire = handler;
      return () => {};
    });
    render(<BrowserPanel active={false} />);
    await act(async () => fire("https://exemplo.com/"));
    await waitFor(() => expect((screen.getByLabelText("Endereço") as HTMLInputElement).value).toBe("https://exemplo.com/"));
  });
});
