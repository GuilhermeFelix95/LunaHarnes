import { useState } from "react";
import { ChevronLeft, ChevronRight, KeyRound, ListChecks, MessagesSquare, Sparkles } from "lucide-react";
import { t } from "../../i18n";

/// Marca no localStorage que a apresentação já foi vista. Sem armazenamento, ela só some nesta abertura.
const DONE_KEY = "luna.onboarding.done";

export function onboardingDone(): boolean {
  try {
    return window.localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function markOnboardingDone() {
  try {
    window.localStorage.setItem(DONE_KEY, "1");
  } catch {
    // Sem armazenamento a apresentação volta na próxima abertura. Não é motivo para travar o app.
  }
}

const STEPS = [
  { icon: Sparkles, title: "onboarding.welcome.title", text: "onboarding.welcome.text" },
  { icon: MessagesSquare, title: "onboarding.engines.title", text: "onboarding.engines.text" },
  { icon: KeyRound, title: "onboarding.accounts.title", text: "onboarding.accounts.text" },
  { icon: ListChecks, title: "onboarding.project.title", text: "onboarding.project.text" },
] as const;

interface OnboardingProps {
  /** Fecha a apresentação (terminou ou pulou). Ela não volta mais nesta instalação. */
  onDone: () => void;
}

/// Apresentação de primeira abertura: quatro telas curtas, com setas, pontos e a Luna no começo.
export function Onboarding({ onDone }: OnboardingProps) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  const Icon = step.icon;

  function finish() {
    markOnboardingDone();
    onDone();
  }

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding__card">
        <button type="button" className="onboarding__skip" onClick={finish}>
          {t("onboarding.skip")}
        </button>

        <div className="onboarding__stage" key={index}>
          {index === 0 ? (
            <img className="onboarding__logo" src="/luna/logo.svg" alt="" />
          ) : (
            <span className="onboarding__icon" aria-hidden="true">
              <Icon size={26} />
            </span>
          )}
          <h2 id="onboarding-title">{t(step.title)}</h2>
          <p>{t(step.text)}</p>
        </div>

        <div className="onboarding__dots" role="group" aria-label={t("onboarding.progressAria")}>
          {STEPS.map((_, i) => (
            <span key={i} className={`onboarding__dot${i === index ? " onboarding__dot--active" : ""}`} aria-hidden="true" />
          ))}
        </div>

        <div className="onboarding__actions">
          <button type="button" className="btn" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
            <ChevronLeft size={16} aria-hidden="true" />
            {t("onboarding.back")}
          </button>
          {last ? (
            <button type="button" className="btn btn--primary" onClick={finish}>
              {t("onboarding.start")}
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={() => setIndex((i) => i + 1)}>
              {t("onboarding.next")}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
