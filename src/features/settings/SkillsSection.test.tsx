import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installSkill, listSkills, loadSkillCatalog } from "../../api";
import { SkillsSection } from "./SkillsSection";

vi.mock("../../api", () => ({
  listSkills: vi.fn(async () => []),
  loadSkillCatalog: vi.fn(async () => ({
    skills: [{ id: "revisar-diff", name: "Revisar mudanças", description: "Revisa o diff", author: "LunaHarness", version: "1.0.0" }],
  })),
  installSkill: vi.fn(async () => []),
  uninstallSkill: vi.fn(async () => {}),
  listSkillSources: vi.fn(async () => []),
  addSkillSource: vi.fn(async () => []),
  removeSkillSource: vi.fn(async () => []),
  SKILLS_CHANGED: "luna:skills-changed",
}));

describe("SkillsSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lista o catálogo e instala a skill nas duas CLIs", async () => {
    render(<SkillsSection />);
    fireEvent.click(screen.getByRole("tab", { name: "Marketplace" }));
    fireEvent.click(await screen.findByRole("button", { name: "Instalar" }));

    await waitFor(() => expect(installSkill).toHaveBeenCalledWith("revisar-diff", undefined));
    expect(listSkills).toHaveBeenCalled();
    expect(loadSkillCatalog).toHaveBeenCalled();
  });

  it("mostra as skills instaladas com as CLIs onde estão", async () => {
    vi.mocked(listSkills).mockResolvedValueOnce([
      { id: "revisar-diff", name: "Revisar mudanças", description: "Revisa o diff", engines: ["claude", "codex"] },
    ]);
    render(<SkillsSection />);

    expect(await screen.findByText("/revisar-diff · claude e codex")).toBeTruthy();
  });
});
