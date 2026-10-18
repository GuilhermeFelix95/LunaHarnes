import { useState } from "react";
import { X } from "lucide-react";
import type { Question } from "../../chat/questions";
import { t } from "../../i18n";

interface QuestionPickerProps {
  questions: Question[];
  /** Recebe as respostas num texto só, que vira a próxima mensagem do turno. */
  onAnswer: (text: string) => void;
  /** Fecha o seletor sem responder: as perguntas somem e a conversa segue. */
  onDismiss: () => void;
}

/// Seletor de perguntas do agente, uma por vez, como no Claude Desktop: escolha única avança sozinha,
/// as demais usam "Próxima". Na última, "Enviar respostas" manda todas juntas.
export function QuestionPicker({ questions, onAnswer, onDismiss }: QuestionPickerProps) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[][]>(() => questions.map(() => []));
  const [other, setOther] = useState<string[]>(() => questions.map(() => ""));
  const isLast = step === questions.length - 1;

  function toggle(index: number, option: string, multiple: boolean) {
    const wasPicked = picked[index].includes(option);
    setPicked((current) =>
      current.map((chosen, i) => {
        if (i !== index) return chosen;
        if (!multiple) return wasPicked ? [] : [option];
        return wasPicked ? chosen.filter((o) => o !== option) : [...chosen, option];
      }),
    );
    // Escolha única já responde: vai para a próxima pergunta.
    if (!multiple && !wasPicked && !isLast) setStep(index + 1);
  }

  function changeOther(index: number, value: string) {
    setOther((current) => current.map((v, i) => (i === index ? value : v)));
  }

  const answers = questions.map((_, i) => {
    const typed = other[i].trim();
    return typed ? [...picked[i], typed] : picked[i];
  });
  const ready = answers.every((answer) => answer.length > 0);

  function submit() {
    onAnswer(questions.map((q, i) => `${q.question}: ${answers[i].join(", ")}`).join("\n"));
  }

  const q = questions[step];
  return (
    <section className="qpick" aria-label={t("question.title")}>
      <header className="qpick__head">
        <span className="qpick__title">
          {t("question.title")} <span className="qpick__count">{t("question.count", { step: step + 1, total: questions.length })}</span>
        </span>
        <button type="button" className="qpick__close" aria-label={t("question.closeAria")} onClick={onDismiss}>
          <X size={14} aria-hidden="true" />
        </button>
      </header>
      <fieldset key={step} className="qpick__item">
        <legend className="qpick__question">{q.question}</legend>
        <div className="qpick__options">
          {q.options.map((option) => (
            <button
              key={option}
              type="button"
              className="qpick__option"
              aria-pressed={picked[step].includes(option)}
              onClick={() => toggle(step, option, q.multiple)}
            >
              {option}
              {option === q.recommended && <span className="qpick__badge">{t("question.recommended")}</span>}
            </button>
          ))}
        </div>
        <input
          className="qpick__other"
          aria-label={t("question.otherAria", { question: q.question })}
          placeholder={t("question.other")}
          value={other[step]}
          onChange={(e) => changeOther(step, e.target.value)}
        />
      </fieldset>
      <div className="qpick__foot">
        {step > 0 && (
          <button type="button" className="btn btn--ghost btn--sm qpick__back" onClick={() => setStep(step - 1)}>
            {t("question.back")}
          </button>
        )}
        {isLast ? (
          <button type="button" className="btn btn--primary btn--sm qpick__send" disabled={!ready} onClick={submit}>
            {t("question.sendAnswers")}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary btn--sm qpick__send"
            disabled={answers[step].length === 0}
            onClick={() => setStep(step + 1)}
          >
            {t("question.next")}
          </button>
        )}
      </div>
    </section>
  );
}
