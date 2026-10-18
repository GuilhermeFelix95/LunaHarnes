import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRules, importRules, saveRules } from "../../api";
import { RulesSection } from "./RulesSection";

vi.mock("../../api", () => ({
  getRules: vi.fn(async () => "regra salva"),
  importRules: vi.fn(async () => "regra do CLAUDE.md"),
  saveRules: vi.fn(async () => ["C:/u/.claude/CLAUDE.md", "C:/u/.codex/AGENTS.md"]),
}));

describe("RulesSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mostra as regras salvas e grava nos arquivos das CLIs", async () => {
    render(<RulesSection />);
    const text = await screen.findByRole("textbox", { name: "Regras globais" });
    await waitFor(() => expect((text as HTMLTextAreaElement).value).toBe("regra salva"));

    fireEvent.change(text, { target: { value: "nova regra" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar regras" }));

    await waitFor(() => expect(saveRules).toHaveBeenCalledWith("nova regra"));
    expect(await screen.findByText(/Gravado em C:\/u\/.claude\/CLAUDE.md e C:\/u\/.codex\/AGENTS.md/)).toBeTruthy();
  });

  it("importa o CLAUDE.md para o campo sem gravar sozinho", async () => {
    render(<RulesSection />);
    await screen.findByDisplayValue("regra salva");

    fireEvent.click(screen.getByRole("button", { name: "Importar do CLAUDE.md" }));

    expect(await screen.findByDisplayValue("regra do CLAUDE.md")).toBeTruthy();
    expect(importRules).toHaveBeenCalledOnce();
    expect(saveRules).not.toHaveBeenCalled();
    expect(getRules).toHaveBeenCalledOnce();
  });
});
