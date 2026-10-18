import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./Select";

const OPTIONS = [
  { value: "readOnly", label: "Só leitura" },
  { value: "acceptEdits", label: "Aceitar edições" },
];

describe("Select", () => {
  it("mostra o nome da opção escolhida no gatilho e abre a lista ao clicar", () => {
    render(<Select label="Permissão" value="acceptEdits" options={OPTIONS} onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Permissão" });
    expect(trigger.textContent).toBe("Aceitar edições");
    expect(screen.queryByRole("option")).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Só leitura", "Aceitar edições"]);
  });

  it("marca a opção atual e avisa a escolha, fechando a lista", () => {
    const onChange = vi.fn();
    render(<Select label="Permissão" value="acceptEdits" options={OPTIONS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Permissão" }));

    expect(screen.getByRole("option", { name: "Aceitar edições" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("option", { name: "Só leitura" }));

    expect(onChange).toHaveBeenCalledWith("readOnly");
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("Esc fecha a lista sem escolher", () => {
    const onChange = vi.fn();
    render(<Select label="Permissão" value="acceptEdits" options={OPTIONS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Permissão" }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("option")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("sem opções ou desabilitado, o gatilho não abre", () => {
    render(<Select label="Esforço" value="" options={[]} onChange={vi.fn()} />);

    expect((screen.getByRole("button", { name: "Esforço" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
