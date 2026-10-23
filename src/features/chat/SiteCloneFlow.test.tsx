import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { siteCloneCapture } from "../../api";
import { CLONE_TARGET_FOLDER, CLONE_TARGET_PROJECT } from "../../chat/siteClone";
import { SiteCloneFlow } from "./SiteCloneFlow";

vi.mock("../../api", () => ({
  siteCloneCapture: vi.fn(),
}));

const capture = { url: "https://exemplo.com/", title: "Loja Exemplo", colors: ["#ff0000"], keyframes: 0, components: ["header"], stylesheets: 0, cssVariables: [] as string[], embeddedCss: "" };

function setup(permission: "acceptEdits" | "readOnly" | "fullAccess" = "acceptEdits") {
  const props = {
    permission,
    onPermission: vi.fn(),
    onSend: vi.fn(),
    onClose: vi.fn(),
  };
  render(<SiteCloneFlow {...props} />);
  return props;
}

/// Escolhe o destino (escolha única avança sozinha), depois as partes, e avança para o formulário.
function pickParts(target: string, ...options: string[]) {
  fireEvent.click(screen.getByRole("button", { name: target }));
  for (const option of options) fireEvent.click(screen.getByRole("button", { name: option }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
}

function fillForm(folder: string, url: string) {
  fireEvent.change(screen.getByLabelText("Nome da pasta do clone"), { target: { value: folder } });
  fireEvent.change(screen.getByLabelText("Endereço do site"), { target: { value: url } });
}

describe("fluxo do clonador no chat", () => {
  beforeEach(() => {
    vi.mocked(siteCloneCapture).mockReset();
    vi.mocked(siteCloneCapture).mockResolvedValue(capture);
  });

  it("mostra o aviso de direitos sem checkbox nem botão de confirmação", () => {
    setup();
    pickParts(CLONE_TARGET_FOLDER, "Cores");

    expect(screen.getByText(/Copiar um site sem autorização/)).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("recusa um nome de pasta com sequência de subida e não captura", () => {
    setup();
    pickParts(CLONE_TARGET_FOLDER, "Cores");
    fillForm("../fora", "https://exemplo.com");
    fireEvent.click(screen.getByRole("button", { name: "Capturar" }));

    expect(screen.getByRole("alert").textContent).toContain("Use só letras");
    expect(siteCloneCapture).not.toHaveBeenCalled();
  });

  it("subpasta: envia o pedido com a pasta e as partes escolhidas", async () => {
    const props = setup();
    pickParts(CLONE_TARGET_FOLDER, "Cores", "Componentes");
    fillForm("Loja Nova", "https://exemplo.com/");
    fireEvent.click(screen.getByRole("button", { name: "Capturar" }));

    await waitFor(() => expect(props.onSend).toHaveBeenCalledOnce());
    const [shown, prompt, folder] = props.onSend.mock.calls[0];
    expect(shown).toContain("Loja Nova");
    expect(folder).toBe("Loja Nova");
    expect(prompt).toContain("Loja Nova/");
    expect(prompt).toContain("Copie somente: Cores, Componentes.");
    expect(prompt).toContain("#ff0000");
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("projeto atual: esconde a pasta e envia sem subpasta", async () => {
    const props = setup();
    pickParts(CLONE_TARGET_PROJECT, "Cores");

    expect(screen.queryByLabelText("Nome da pasta do clone")).toBeNull();
    fireEvent.change(screen.getByLabelText("Endereço do site"), { target: { value: "https://exemplo.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Capturar" }));

    await waitFor(() => expect(props.onSend).toHaveBeenCalledOnce());
    const [shown, prompt, folder] = props.onSend.mock.calls[0];
    expect(shown).toContain("no projeto atual");
    expect(folder).toBeNull();
    expect(prompt).toContain("código do projeto atual");
    expect(prompt).not.toContain("Salve o resultado na pasta");
  });

  it("com Só leitura, avisa e não deixa enviar; o aviso oferece Pedir permissão", () => {
    const props = setup("readOnly");
    pickParts(CLONE_TARGET_FOLDER, "Cores");

    expect(screen.getByRole("status").textContent).toContain("Só leitura");
    expect((screen.getByRole("button", { name: "Capturar" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Usar Pedir permissão" }));
    expect(props.onPermission).toHaveBeenCalledWith("acceptEdits");
  });
});
