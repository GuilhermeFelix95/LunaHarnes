import { contextPercent, formatReset, formatTokens, utilizationPercent } from "../../chat/usage";

export interface LimitInfo {
  /** Fração de 0 a 1, como a CLI envia. */
  utilization: number;
  resetsAt: number;
}

export type LimitState = Partial<Record<"fiveHour" | "sevenDay", LimitInfo>>;

export interface ContextState {
  tokens: number;
  /** Ausente quando a API não informa a janela do modelo: mostra só os tokens usados. */
  windowSize?: number;
}

interface UsageMeterProps {
  limits: LimitState;
  context: ContextState | null;
  /** Dica mostrada quando a janela é desconhecida (ex.: modelo de API sem janela salva). */
  windowHint?: string;
}

/// Uso da conta e do contexto, no rodapé do chat. Só mostra o que a CLI já informou.
export function UsageMeter({ limits, context, windowHint }: UsageMeterProps) {
  // Rótulos curtos para caber numa linha; o texto completo (com o reset) fica no title.
  const windows: Array<[string, string, "fiveHour" | "sevenDay"]> = [
    ["5 h", "Sessão de 5 h", "fiveHour"],
    ["Semana", "Semana", "sevenDay"],
  ];
  const known = windows.filter(([, , key]) => limits[key]);

  if (!context && known.length === 0) return null;

  return (
    <div className="usage" role="group" aria-label="Uso da conta e do contexto">
      {context && context.windowSize === undefined && (
        <div className="usage__item" title="Janela de contexto do último turno">
          <span className="usage__label">Contexto · {formatTokens(context.tokens)} usados</span>
          {windowHint && <span className="usage__label usage__hint">{windowHint}</span>}
        </div>
      )}
      {context && context.windowSize !== undefined && (
        <div
          className="usage__item"
          title={`Janela de contexto do último turno: ${formatTokens(context.tokens)} de ${formatTokens(context.windowSize)}`}
        >
          <span className="usage__label">Contexto · {contextPercent(context.tokens, context.windowSize)}%</span>
          <Bar percent={contextPercent(context.tokens, context.windowSize)} />
        </div>
      )}

      {known.map(([short, label, key]) => {
        const info = limits[key]!;
        const percent = utilizationPercent(info.utilization);
        return (
          <div className="usage__item" key={key} title={`${label} · ${percent}% · reseta ${formatReset(info.resetsAt, key)}`}>
            <span className="usage__label">
              {short} · {percent}%
            </span>
            <Bar percent={percent} />
          </div>
        );
      })}
    </div>
  );
}

function Bar({ percent }: { percent: number }) {
  return (
    <span className="usage__bar" aria-hidden="true">
      <span className="usage__fill" style={{ width: `${percent}%` }} />
    </span>
  );
}
