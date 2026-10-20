import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressTimeline } from "./ProgressTimeline";

const TODOS = [
  { content: "Criar spec", status: "completed" as const },
  { content: "Escrever testes", status: "in_progress" as const },
  { content: "Integrar cache", status: "pending" as const },
];

describe("ProgressTimeline", () => {
  it("mostra quantas etapas já foram concluídas", () => {
    render(<ProgressTimeline todos={TODOS} />);

    expect(screen.getByText("1 de 3 concluídas (33%)")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("1");
  });

  it("marca a etapa em andamento como a atual, com o nome do estado", () => {
    render(<ProgressTimeline todos={TODOS} />);

    const current = screen.getByText("Escrever testes").closest("li");
    expect(current?.getAttribute("aria-current")).toBe("step");
    expect(current?.textContent).toContain("Em andamento");
    expect(screen.getByText("Criar spec").closest("li")?.textContent).toContain("Concluída");
    expect(screen.getByText("Integrar cache").closest("li")?.getAttribute("aria-current")).toBeNull();
  });
});
