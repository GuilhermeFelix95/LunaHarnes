import { useEffect, useState } from "react";
import { t } from "../../i18n";
import { currentVersion, findUpdate, type AvailableUpdate } from "../../updates";

type Status = "idle" | "checking" | "upToDate" | "available" | "installing" | "error" | "installError";

/// Versão instalada e busca manual de atualização.
export function AboutSection() {
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);

  useEffect(() => {
    currentVersion().then(setVersion, () => setVersion(null));
  }, []);

  async function check() {
    setStatus("checking");
    try {
      const found = await findUpdate();
      setUpdate(found);
      setStatus(found ? "available" : "upToDate");
    } catch {
      setStatus("error");
    }
  }

  async function install() {
    if (!update) return;
    setStatus("installing");
    try {
      await update.install();
    } catch {
      setStatus("installError");
    }
  }

  const busy = status === "checking" || status === "installing";

  return (
    <section className="settings__section" aria-labelledby="settings-about">
      <h2 id="settings-about">{t("settings.nav.about")}</h2>
      {version && <p>{t("about.version", { version })}</p>}
      <div className="settings__row">
        <button type="button" disabled={busy} onClick={check}>
          {status === "checking" ? t("about.checking") : t("about.check")}
        </button>
      </div>
      {status === "upToDate" && <p role="status">{t("about.upToDate")}</p>}
      {status === "available" && update && (
        <div>
          <p role="status">{t("about.available", { version: update.version })}</p>
          {update.notes && <pre className="about__notes">{update.notes}</pre>}
          <div className="settings__row">
            <button type="button" onClick={install}>
              {t("about.install")}
            </button>
          </div>
        </div>
      )}
      {status === "installing" && <p role="status">{t("about.installing")}</p>}
      {status === "error" && <p role="alert">{t("about.error")}</p>}
      {status === "installError" && <p role="alert">{t("about.installError")}</p>}
    </section>
  );
}
