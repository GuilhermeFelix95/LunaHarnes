import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UsageMeter } from "./UsageMeter";

describe("UsageMeter", () => {
  it("não aparece enquanto a CLI não informou nada", () => {
    const { container } = render(<UsageMeter limits={{}} context={null} />);

    expect(container.firstChild).toBeNull();
  });

  it("mostra o contexto do turno com tokens e porcentagem", () => {
    render(<UsageMeter limits={{}} context={{ tokens: 44060, windowSize: 1_000_000 }} />);

    expect(screen.getByText(/44 mil de 1,0 mi \(4%\)/)).toBeTruthy();
  });

  it("mostra a sessão de 5 horas e a semana com porcentagem e reset", () => {
    render(
      <UsageMeter
        limits={{
          fiveHour: { utilization: 0.45, resetsAt: 1792266000 },
          sevenDay: { utilization: 0.35, resetsAt: 1792512000 },
        }}
        context={null}
      />,
    );

    expect(screen.getByText(/Sessão de 5 h · 45% · reseta/)).toBeTruthy();
    expect(screen.getByText(/Semana · 35% · reseta/)).toBeTruthy();
  });

  it("mostra só a janela que a CLI informou", () => {
    render(<UsageMeter limits={{ fiveHour: { utilization: 0.1, resetsAt: 1792266000 } }} context={null} />);

    expect(screen.queryByText(/Semana/)).toBeNull();
  });
});
