import { useEffect, useState } from "react";
import { playwrightInstall, playwrightStatus } from "../../api";
import { getAgentBrowser, setAgentBrowser } from "../../chat/agentBrowser";
import type { AgentBrowser } from "../../types";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { t } from "../../i18n";

const OPTIONS = [
  ["builtin", "settings.browser.builtin"],
  ["playwright", "settings.browser.playwright"],
] as const;

/// Navegador do agente. Só um vale por vez: o escolhido é o único que o agente recebe.
/// Instalar o Chromium do Playwright baixa arquivos grandes, então só roda depois de confirmar.
export function BrowserSection() {
  const [choice, setChoice] = useState<AgentBrowser>(getAgentBrowser);
  // true/false = Chromium do Playwright baixado ou não; undefined = ainda verificando.
  const [installed, setInstalled] = useState<boolean | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    playwrightStatus().then(setInstalled, () => setInstalled(false));
  }, []);

  function change(next: AgentBrowser) {
    setChoice(next);
    setAgentBrowser(next);
  }

  async function install() {
    setConfirming(false);
    setBusy(true);
    setError(undefined);
    try {
      await playwrightInstall();
      setInstalled(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings__section" aria-labelledby="settings-browser">
      <h2 id="settings-browser">{t("settings.browser.title")}</h2>
      <p className="settings__hint">{t("settings.browser.help")}</p>
      <div role="radiogroup" aria-labelledby="settings-browser">
        {OPTIONS.map(([id, key]) => (
          <label key={id} className="settings__check">
            <input type="radio" name="agent-browser" value={id} checked={choice === id} onChange={() => change(id)} />
            <span>{t(key)}</span>
          </label>
        ))}
      </div>

      {choice === "playwright" && installed === false && (
        <div>
          <p className="settings__hint">{t("settings.browser.notInstalled")}</p>
          <button type="button" className="btn btn--sm" disabled={busy} onClick={() => setConfirming(true)}>
            {busy ? t("settings.browser.installing") : t("settings.browser.install")}
          </button>
        </div>
      )}
      {error && (
        <p className="settings__hint" role="alert">
          {error}
        </p>
      )}

      {confirming && (
        <ConfirmDialog
          title={t("settings.browser.installTitle")}
          body={t("settings.browser.installBody")}
          confirmLabel={t("settings.browser.installConfirm")}
          onConfirm={() => void install()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </section>
  );
}
