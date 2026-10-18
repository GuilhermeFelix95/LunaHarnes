import { useEffect, useState } from "react";
import { getRules, importRules, saveRules } from "../../api";
import { t } from "../../i18n";

/// Regras globais: o CLAUDE.md que vale para qualquer CLI. Ao salvar, o texto vai para os arquivos das CLIs.
export function RulesSection() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRules()
      .then(setText)
      .catch((e) => setStatus(String(e)));
  }, []);

  async function save() {
    setBusy(true);
    try {
      const files = await saveRules(text);
      setStatus(t("rules.saved", { files: files.join(t("common.and")) }));
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function importFromClaude() {
    setBusy(true);
    try {
      setText(await importRules());
      setStatus(t("rules.imported"));
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings__section" aria-labelledby="settings-rules">
      <h2 id="settings-rules">{t("settings.nav.rules")}</h2>
      <p className="settings__hint">{t("rules.help")}</p>
      <textarea
        className="rules__text"
        aria-label={t("settings.nav.rules")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
      <div className="settings-actions">
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={importFromClaude}>
          {t("rules.import")}
        </button>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={save}>
          {t("rules.save")}
        </button>
      </div>
      {status && (
        <p className="settings__hint" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
