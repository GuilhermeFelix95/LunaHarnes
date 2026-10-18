import { useState } from "react";
import { X } from "lucide-react";
import type { Question } from "../../chat/questions";

interface QuestionPickerProps {
  questions: Question[];
  /** Recebe as respostas num texto só, que vira a próxima mensagem do turno. */
  onAnswer: (text: string) => void;
  /** Fecha o seletor sem responder: as perguntas somem e a conversa segue. */
  onDismiss: () => void;
}

/// Seletor de perguntas do agente: opções prontas, uma resposta livre e um envio só.
export function QuestionPicker({ questions, onAnswer, onDismiss }: QuestionPickerProps) {
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
    <section className="qpick" aria-label="Perguntas do agente">
      <header className="qpick__head">
        <span className="qpick__title">Perguntas do agente</span>
        <button type="button" className="qpick__close" aria-label="Fechar perguntas" onClick={onDismiss}>
          <X size={14} aria-hidden="true" />
        </button>
      </header>
      {questions.map((q, qi) => (
        <fieldset key={qi} className="qpick__item">
          <legend className="qpick__question">{q.question}</legend>
          <div className="qpick__options">
            {q.options.map((option) => (
              <button
                key={option}
                type="button"
                className="qpick__option"
                aria-pressed={picked[qi].includes(option)}
                onClick={() => toggle(qi, option, q.multiple)}
              >
                {option}
              </button>
            ))}
          </div>
          <input
            className="qpick__other"
            aria-label={`Outra resposta: ${q.question}`}
            placeholder="Outra resposta"
            value={other[qi]}
            onChange={(e) => changeOther(qi, e.target.value)}
          />
        </fieldset>
      ))}
      <div className="qpick__foot">
        <button type="button" className="qpick__send" disabled={!ready} onClick={submit}>
          Enviar respostas
        </button>
      </div>
    </section>
  );
}
