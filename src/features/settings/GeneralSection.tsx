import { useState } from "react";
import { getLanguageChoice, setLanguageChoice, t, type LanguageChoice } from "../../i18n";

/// Idioma da interface. "Sistema" segue o computador; idioma sem tradução cai no inglês.
const LANGUAGE_OPTIONS = [
  ["system", "settings.general.languageSystem"],
  ["pt-BR", "settings.general.languagePt"],
  ["en", "settings.general.languageEn"],
] as const;

export function GeneralSection() {
  const [choice, setChoice] = useState<LanguageChoice>(getLanguageChoice);

  function changeLanguage(next: LanguageChoice) {
    setChoice(next);
    setLanguageChoice(next);
  }

  return (
    <section className="settings__section" aria-labelledby="settings-language">
      <h2 id="settings-language">{t("settings.general.language")}</h2>
      <p className="settings__hint">{t("settings.general.languageHelp")}</p>
      <div role="radiogroup" aria-labelledby="settings-language">
        {LANGUAGE_OPTIONS.map(([id, key]) => (
          <label key={id} className="settings__check">
            <input
              type="radio"
              name="interface-language"
              value={id}
              checked={choice === id}
              onChange={() => changeLanguage(id)}
            />
            {t(key)}
          </label>
        ))}
      </div>
    </section>
  );
}
