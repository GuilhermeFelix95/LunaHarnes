import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_KEY } from "../../theme";
import { SettingsView } from "./SettingsView";

describe("SettingsView", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("lista os temas e marca o atual", () => {
    localStorage.setItem(THEME_KEY, "duna");
    render(<SettingsView onClose={() => {}} />);

    expect(screen.getAllByRole("radio")).toHaveLength(7);
    expect(screen.getByRole("radio", { name: /Duna/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("escolher um tema aplica na hora e salva", () => {
    render(<SettingsView onClose={() => {}} />);

    fireEvent.click(screen.getByRole("radio", { name: /Grafite/ }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("grafite");
    expect(localStorage.getItem(THEME_KEY)).toBe("grafite");
    expect(screen.getByRole("radio", { name: /Grafite/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("botão de voltar fecha a página", () => {
    const onClose = vi.fn();
    render(<SettingsView onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Voltar ao chat" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
