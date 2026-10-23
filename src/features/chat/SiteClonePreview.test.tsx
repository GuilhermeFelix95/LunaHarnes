import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readProjectFile } from "../../api";
import { SiteClonePreview } from "./SiteClonePreview";

vi.mock("../../api", () => ({
  readProjectFile: vi.fn(),
}));

describe("SiteClonePreview", () => {
  beforeEach(() => {
    vi.mocked(readProjectFile).mockReset();
  });

  it("mostra o index.html da subpasta num iframe sem acesso ao app", async () => {
    vi.mocked(readProjectFile).mockResolvedValue("<h1>Loja Nova</h1>");
    const { container } = render(<SiteClonePreview cwd="C:/projeto" folder="Loja Nova" onClose={() => {}} />);

    await waitFor(() => expect(container.querySelector("iframe")?.getAttribute("srcdoc")).toBe("<h1>Loja Nova</h1>"));
    const frame = container.querySelector("iframe") as HTMLIFrameElement;
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(readProjectFile).toHaveBeenCalledWith("C:/projeto", "Loja Nova/index.html");
  });

  it("explica quando a pasta ainda não tem index.html", async () => {
    vi.mocked(readProjectFile).mockRejectedValue("arquivo não encontrado");
    const { container } = render(<SiteClonePreview cwd="C:/projeto" folder="Vazia" onClose={() => {}} />);

    expect(await screen.findByText(/Ainda não há index.html/)).toBeTruthy();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("atualiza a prévia quando pedido, e fecha pelo X", async () => {
    vi.mocked(readProjectFile).mockRejectedValueOnce("ainda não");
    vi.mocked(readProjectFile).mockResolvedValueOnce("<p>pronto</p>");
    const onClose = vi.fn();
    const { container } = render(<SiteClonePreview cwd="C:/projeto" folder="Loja" onClose={onClose} />);
    await screen.findByText(/Ainda não há index.html/);

    fireEvent.click(screen.getByRole("button", { name: "Atualizar prévia" }));
    await waitFor(() => expect(container.querySelector("iframe")?.getAttribute("srcdoc")).toBe("<p>pronto</p>"));

    fireEvent.click(screen.getByRole("button", { name: "Fechar prévia" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
