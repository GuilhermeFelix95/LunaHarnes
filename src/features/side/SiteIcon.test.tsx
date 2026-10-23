import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { browserFavicon } from "../../api";
import { SiteIcon } from "./SiteIcon";

vi.mock("../../api", () => ({
  browserFavicon: vi.fn(async () => null),
}));

describe("SiteIcon", () => {
  beforeEach(() => {
    vi.mocked(browserFavicon).mockReset();
  });

  it("mostra o ícone que o site devolveu", async () => {
    vi.mocked(browserFavicon).mockResolvedValue("data:image/png;base64,AAAA");
    const { container } = render(<SiteIcon url="https://exemplo-icone-1.com/pagina" />);

    await waitFor(() => expect(container.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,AAAA"));
    expect(browserFavicon).toHaveBeenCalledWith("https://exemplo-icone-1.com/pagina");
  });

  it("mostra o globo quando o site não tem ícone", async () => {
    vi.mocked(browserFavicon).mockResolvedValue(null);
    const { container } = render(<SiteIcon url="https://exemplo-icone-2.com/" />);

    await waitFor(() => expect(browserFavicon).toHaveBeenCalled());
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".browser__site-icon--fallback")).toBeTruthy();
  });

  it("não pede ícone para aba em branco", () => {
    const { container } = render(<SiteIcon url="" />);

    expect(browserFavicon).not.toHaveBeenCalled();
    expect(container.querySelector(".browser__site-icon--fallback")).toBeTruthy();
  });

  it("guarda o resultado: a mesma página não é consultada de novo", async () => {
    vi.mocked(browserFavicon).mockResolvedValue(null);
    render(<SiteIcon url="https://exemplo-icone-3.com/" />);
    await waitFor(() => expect(browserFavicon).toHaveBeenCalledTimes(1));

    render(<SiteIcon url="https://exemplo-icone-3.com/" />);
    expect(browserFavicon).toHaveBeenCalledTimes(1);
  });
});
