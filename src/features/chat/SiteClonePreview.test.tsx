import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { browserPreviewUrl } from "../../api";
import { SiteClonePreview } from "./SiteClonePreview";

vi.mock("../../api", () => ({
  browserPreviewUrl: vi.fn(),
}));

describe("SiteClonePreview", () => {
  beforeEach(() => {
    vi.mocked(browserPreviewUrl).mockReset();
  });

  it("abre a prévia no navegador embutido, e não num quadro dentro do chat", async () => {
    vi.mocked(browserPreviewUrl).mockResolvedValue("http://127.0.0.1:5000/index.html");
    const onOpen = vi.fn();
    const { container } = render(<SiteClonePreview cwd="C:/projeto" folder="Loja Nova" onOpen={onOpen} onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir prévia no navegador" }));

    await waitFor(() => expect(onOpen).toHaveBeenCalledWith("http://127.0.0.1:5000/index.html"));
    expect(browserPreviewUrl).toHaveBeenCalledWith("C:/projeto", "Loja Nova");
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("mostra o motivo quando a pasta não tem como ser aberta", async () => {
    vi.mocked(browserPreviewUrl).mockRejectedValue("ainda não há index.html nesta pasta");
    const onOpen = vi.fn();
    render(<SiteClonePreview cwd="C:/projeto" folder="Vazia" onOpen={onOpen} onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir prévia no navegador" }));

    expect((await screen.findByRole("alert")).textContent).toContain("ainda não há index.html");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("fecha pelo X", () => {
    const onClose = vi.fn();
    render(<SiteClonePreview cwd="C:/projeto" folder="Loja" onOpen={() => {}} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Fechar prévia" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
