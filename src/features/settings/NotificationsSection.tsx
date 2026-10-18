import { useState } from "react";
import { notificationsEnabled, setNotificationsEnabled } from "../../notifications";
import { setToastsEnabled, toastsEnabled } from "../../ui/toast";
import { loadSound, playSound, saveSound, SOUND_OFF, SOUNDS, type SoundChoice } from "../../sounds";

/// Liga e desliga os avisos do sistema para respostas prontas, erros e planos, e escolhe o som da resposta.
export function NotificationsSection() {
  const [on, setOn] = useState(notificationsEnabled);
  const [sound, setSound] = useState<SoundChoice>(loadSound);
  const [toast, setToast] = useState(toastsEnabled);

  function changeSound(choice: SoundChoice) {
    setSound(choice);
    saveSound(choice);
  }

  return (
    <section className="settings__section" aria-labelledby="settings-notifications">
      <h2 id="settings-notifications">Notificações</h2>
      <label className="settings__check">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            setNotificationsEnabled(e.target.checked);
          }}
        />
        Avisar quando uma resposta terminar, falhar ou um plano estiver pronto, com a janela fora de foco
      </label>
      <label className="settings__check">
        <input
          type="checkbox"
          checked={toast}
          onChange={(e) => {
            setToast(e.target.checked);
            setToastsEnabled(e.target.checked);
          }}
        />
        Mostrar aviso na tela quando a resposta terminar
      </label>
      <div className="settings__row">
        <label>
          Som ao responder
          <select className="sound-select" value={sound} onChange={(e) => changeSound(e.target.value as SoundChoice)}>
            {SOUNDS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
            <option value={SOUND_OFF}>Desligado</option>
          </select>
        </label>
        <button
          type="button"
          disabled={sound === SOUND_OFF}
          onClick={() => {
            if (sound !== SOUND_OFF) playSound(sound);
          }}
        >
          Ouvir
        </button>
      </div>
    </section>
  );
}
