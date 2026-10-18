import { useState } from "react";
import { autoCompactEnabled, setAutoCompact } from "../../chat/compact";

/// Conversa: compactação automática. O botão Compactar e o comando /compactar funcionam sempre.
export function ConversationSection() {
  const [auto, setAuto] = useState(autoCompactEnabled);

  return (
    <section className="settings__section" aria-labelledby="settings-conversation">
      <h2 id="settings-conversation">Conversa</h2>
      <label className="settings__check">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => {
            setAuto(e.target.checked);
            setAutoCompact(e.target.checked);
          }}
        />
        Compactar sozinha quando o contexto passar de 90%
      </label>
      <p className="settings__hint">
        Compactar resume a conversa para liberar espaço. Use o botão Compactar ou o comando /compactar quando quiser.
      </p>
    </section>
  );
}
