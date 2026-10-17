import { useState } from "react";
import { notificationsEnabled, setNotificationsEnabled } from "../../notifications";

/// Liga e desliga os avisos do sistema para respostas prontas, erros e planos.
export function NotificationsSection() {
  const [on, setOn] = useState(notificationsEnabled);

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
    </section>
  );
}
