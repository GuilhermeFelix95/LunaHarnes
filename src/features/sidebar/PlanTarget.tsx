import { useState } from "react";
import { loadPlanTarget, savePlanTarget } from "../../chat/planning";

/// Meta de contexto do plano, na barra esquerda, logo abaixo de Configurações. Vale no próximo envio do modo Planejar.
export function PlanTarget() {
  const [target, setTarget] = useState(loadPlanTarget);

  function change(value: number) {
    setTarget(value);
    savePlanTarget(value);
  }

  return (
    <label className="plan-target" title="Quanto do contexto a Luna precisa entender antes de montar o plano">
      <span>Contexto do plano: {target}%</span>
      <input
        type="range"
        min={50}
        max={100}
        step={5}
        value={target}
        aria-label="Contexto do plano"
        onChange={(e) => change(Number(e.target.value))}
      />
    </label>
  );
}
