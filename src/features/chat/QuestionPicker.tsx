import { useState } from "react";
import type { Question } from "../../chat/questions";

interface QuestionPickerProps {
  questions: Question[];
  /** Recebe as respostas num texto só, que vira a próxima mensagem do turno. */
  onAnswer: (text: string) => void;
}

/// Seletor de perguntas do agente: opções prontas, uma resposta livre e um envio só.
export function QuestionPicker({ questions, onAnswer }: QuestionPickerProps) {
  const [picked, setPicked] = useState<string[][]>(() => questions.map(() => []));
  const [other, setOther] = useState<string[]>(() => questions.map(() => ""));

  function toggle(index: number, option: string, multiple: boolean) {
    setPicked((current) =>
      current.map((chosen, i) => {
        if (i !== index) return chosen;
        if (!multiple) return chosen[0] === option ? [] : [option];
        return chosen.includes(option) ? chosen.filter((o) => o !== option) : [...chosen, option];
      }),
    );
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

  return (
    <section className="question-picker" aria-label="Perguntas do agente">
      {questions.map((q, qi) => (
        <fieldset key={qi} className="question-picker__item">
          <legend>{q.question}</legend>
          <div className="question-picker__options">
            {q.options.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={picked[qi].includes(option)}
                onClick={() => toggle(qi, option, q.multiple)}
              >
                {option}
              </button>
            ))}
          </div>
          <input
            aria-label={`Outra resposta: ${q.question}`}
            placeholder="Outra resposta"
            value={other[qi]}
            onChange={(e) => changeOther(qi, e.target.value)}
          />
        </fieldset>
      ))}
      <button type="button" className="question-picker__send" disabled={!ready} onClick={submit}>
        Enviar respostas
      </button>
    </section>
  );
}
