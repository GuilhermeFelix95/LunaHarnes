import { useState } from "react";
import { notificationsEnabled, setNotificationsEnabled } from "../../notifications";
import { setToastsEnabled, toastsEnabled } from "../../ui/toast";
import { loadSound, playSound, saveSound, SOUND_OFF, SOUNDS, type SoundChoice } from "../../sounds";
import { t, type MessageKey } from "../../i18n";

/// Nome de cada som, traduzido pela chave.
const SOUND_KEYS: Record<(typeof SOUNDS)[number]["id"], MessageKey> = {
  sino: "sound.sino",
  gota: "sound.gota",
  lua: "sound.lua",
  miau: "sound.miau",
  pop: "sound.pop",
};

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
      <h2 id="settings-notifications">{t("settings.nav.notifications")}</h2>
      <label className="settings__check">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            setNotificationsEnabled(e.target.checked);
          }}
        />
        {t("notifications.onAlert")}
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
        {t("notifications.onToast")}
      </label>
      <div className="settings__row">
        <label>
          {t("notifications.sound")}
          <select className="sound-select" value={sound} onChange={(e) => changeSound(e.target.value as SoundChoice)}>
            {SOUNDS.map((s) => (
              <option key={s.id} value={s.id}>
                {t(SOUND_KEYS[s.id])}
              </option>
            ))}
            <option value={SOUND_OFF}>{t("notifications.soundOff")}</option>
          </select>
        </label>
        <button
          type="button"
          disabled={sound === SOUND_OFF}
          onClick={() => {
            if (sound !== SOUND_OFF) playSound(sound);
          }}
        >
          {t("notifications.listen")}
        </button>
      </div>
    </section>
  );
}
