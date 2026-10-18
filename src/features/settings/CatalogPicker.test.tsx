import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogPicker } from "./CatalogPicker";

describe("CatalogPicker", () => {
  it("adiciona um catálogo por URL com o endereço sem espaços e mostra o erro da validação", async () => {
    const onAdd = vi.fn(async (url: string) => {
      if (!url.startsWith("https://")) throw new Error("endereço inválido: Use https://");
    });
    render(<CatalogPicker sources={[]} value="" onChange={vi.fn()} onAdd={onAdd} onRemove={vi.fn(async () => {})} />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar catálogo" }));
    fireEvent.change(screen.getByLabelText("Endereço do catálogo"), { target: { value: "http://exemplo.com/c.json" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(onAdd).toHaveBeenCalledWith("http://exemplo.com/c.json");
  });

  it("remove o catálogo escolhido e volta para o oficial", async () => {
    const onChange = vi.fn();
    const onRemove = vi.fn(async () => {});
    render(
      <CatalogPicker sources={["https://exemplo.com/c.json"]} value="https://exemplo.com/c.json" onChange={onChange} onAdd={vi.fn(async () => {})} onRemove={onRemove} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remover catálogo" }));

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith("https://exemplo.com/c.json"));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(""));
  });
});
