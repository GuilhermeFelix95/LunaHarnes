import { useState } from "react";
import { installCli } from "../../api";
import type { CliStatus, ProviderKind } from "../../types";
import { t } from "../../i18n";

const NAMES: Record<ProviderKind, string> = { claude: "Claude Code", codex: "Codex", opencode: "OpenCode", cline: "Cline", copilot: "GitHub Copilot", antigravity: "Antigravity", hermes: "Hermes" };

interface SetupScreenProps {
  /** Situação atual das CLIs, vinda de `cli_status`. */
  statuses: CliStatus[];
  /** Fecha a tela (instalou tudo ou pulou). Não instala nada sozinho. */
  onSkip: () => void;
}

/// Tela de primeira abertura: mostra o que já está instalado e instala só o que falta, com clique.
export function SetupScreen({ statuses: initial, onSkip }: SetupScreenProps) {
  const [statuses, setStatuses] = useState(initial);
  const [busy, setBusy] = useState<ProviderKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allInstalled = statuses.every((status) => status.installed);

  async function install(kind: ProviderKind) {
    setBusy(kind);
    setError(null);
    try {
      const updated = await installCli(kind);
      setStatuses((current) => current.map((status) => (status.provider === kind ? updated : status)));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="setup" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <div className="setup__card">
        <h2 id="setup-title">{t("setup.title")}</h2>
        <p className="setup__intro">{t("setup.intro")}</p>

        <ul className="setup__list">
          {statuses.map((status) => (
            <li key={status.provider} className="setup__item">
              <div>
                <strong>{NAMES[status.provider]}</strong>
                <span className="setup__state">
                  {status.installed && status.path ? t("setup.installedAt", { path: status.path }) : t("setup.notFound")}
                </span>
              </div>
              {!status.installed && (
                <button type="button" className="btn btn--primary" onClick={() => void install(status.provider)} disabled={busy !== null}>
                  {busy === status.provider ? t("setup.installing") : t("common.install")}
                </button>
              )}
            </li>
          ))}
        </ul>

        {error && <p role="alert" className="setup__error">{error}</p>}

        <div className="setup__actions">
          <button type="button" className="btn setup__skip" onClick={onSkip} disabled={busy !== null}>
            {allInstalled ? t("setup.continue") : t("setup.skip")}
          </button>
        </div>
      </div>
    </div>
  );
}
