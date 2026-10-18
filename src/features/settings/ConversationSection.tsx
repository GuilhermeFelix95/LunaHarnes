import { useState } from "react";
import { autoCompactEnabled, setAutoCompact } from "../../chat/compact";
import { longCacheEnabled, setLongCache } from "../../chat/cacheSettings";

/// Conversa: compactação automática. O botão Compactar e o comando /compactar funcionam sempre.
export function ConversationSection() {
  const [auto, setAuto] = useState(autoCompactEnabled);
  const [longCache, setLongCacheOn] = useState(longCacheEnabled);

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
      <label className="settings__check">
        <input
          type="checkbox"
          checked={longCache}
          onChange={(e) => {
            setLongCacheOn(e.target.checked);
            setLongCache(e.target.checked);
          }}
        />
        Cache longo (1 h) para chaves de API da Anthropic
      </label>
      <p className="settings__hint">
        O cache de 1 h mantém o contexto por mais tempo entre as mensagens: escrever no cache custa mais, reler custa menos. Só vale para chave da Anthropic.
      </p>
      <p className="settings__hint">
        Compactar resume a conversa para liberar espaço. Use o botão Compactar ou o comando /compactar quando quiser.
      </p>
    </section>
  );
}
