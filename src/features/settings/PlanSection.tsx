import { useState } from "react";
import { loadPlanTarget, savePlanTarget } from "../../chat/planning";

/// Quanto do contexto a Luna precisa entender antes de montar o plano. Vale no próximo envio do modo Planejar.
export function PlanSection() {
  const [target, setTarget] = useState(loadPlanTarget);

  function change(value: number) {
    setTarget(value);
    savePlanTarget(value);
  }

  return (
    <section className="settings__section" aria-labelledby="settings-plan">
      <h2 id="settings-plan">Planejamento</h2>
      <p className="settings__hint">
        Antes de montar o plano, a Luna faz perguntas e diz quanto do contexto já entendeu. O plano só sai quando ela chega à meta.
      </p>
      <label className="custom-palette__item">
        <span>Contexto necessário para o plano: {target}%</span>
        <input
          type="range"
          min={50}
          max={100}
          step={5}
          value={target}
          aria-label="Contexto necessário para o plano"
          onChange={(e) => change(Number(e.target.value))}
        />
      </label>
    </section>
  );
}
