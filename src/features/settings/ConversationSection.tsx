import { useState } from "react";
import { autoCompactEnabled, setAutoCompact } from "../../chat/compact";
import { longCacheEnabled, setLongCache } from "../../chat/cacheSettings";
import { t } from "../../i18n";

/// Conversa: compactação automática. O botão Compactar e o comando /compactar funcionam sempre.
export function ConversationSection() {
  const [auto, setAuto] = useState(autoCompactEnabled);
  const [longCache, setLongCacheOn] = useState(longCacheEnabled);

  return (
    <section className="settings__section" aria-labelledby="settings-conversation">
      <h2 id="settings-conversation">{t("settings.nav.conversation")}</h2>
      <label className="settings__check">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => {
            setAuto(e.target.checked);
            setAutoCompact(e.target.checked);
          }}
        />
        {t("conversation.autoCompact")}
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
        {t("conversation.longCache")}
      </label>
      <p className="settings__hint">{t("conversation.longCacheHint")}</p>
      <p className="settings__hint">{t("conversation.compactHint")}</p>
    </section>
  );
}
