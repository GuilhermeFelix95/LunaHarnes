import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Onboarding, onboardingDone } from "./Onboarding";

describe("apresentação de primeira abertura", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("começa na Luna e avança pelas telas com Próximo", () => {
    render(<Onboarding onDone={() => {}} />);

    expect(screen.getByRole("heading", { name: "Oi, eu sou a Luna" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByRole("heading", { name: "Escolha o agente" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeTruthy();
  });

  it("no fim, Começar fecha, marca como vista e não volta", () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);

    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onboardingDone()).toBe(true);
  });

  it("Pular fecha em qualquer tela e também marca como vista", () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);

    fireEvent.click(screen.getByRole("button", { name: "Pular" }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onboardingDone()).toBe(true);
  });

  it("na primeira tela, Voltar fica desligado", () => {
    render(<Onboarding onDone={() => {}} />);

    expect((screen.getByRole("button", { name: "Voltar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sem o que ler do armazenamento, a apresentação aparece de novo", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("sem armazenamento");
    });

    expect(onboardingDone()).toBe(false);
    vi.restoreAllMocks();
  });
});
