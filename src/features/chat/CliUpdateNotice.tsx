import { useState } from "react";
import { cliUpdateRun } from "../../api";
import { PROVIDER_LABELS } from "../../chat/providers";
import { t } from "../../i18n";
import type { CliUpdateInfo } from "../../types";
import { ConfirmDialog } from "../../ui/ConfirmDialog";

interface CliUpdateNoticeProps {
  infos: CliUpdateInfo[];
  /** Situação nova de uma CLI depois de atualizada: quem mostra o aviso troca a linha. */
  onUpdated: (info: CliUpdateInfo) => void;
}

/// Faixa com as CLIs que têm versão nova. Atualizar sempre pede confirmação antes de rodar o comando.
export function CliUpdateNotice({ infos, onUpdated }: CliUpdateNoticeProps) {
  const [pending, setPending] = useState<CliUpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  if (infos.length === 0) return null;

  async function update(info: CliUpdateInfo) {
    setPending(null);
    setBusy(true);
    setError(undefined);
    try {
      onUpdated(await cliUpdateRun(info.provider, true));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cli-update" role="status">
      {infos.map((info) => (
        <div key={info.provider} className="cli-update__row">
          <span>
            {t("cliUpdate.available", {
              name: PROVIDER_LABELS[info.provider],
              installed: info.installed ?? "?",
              latest: info.latest ?? "?",
            })}
          </span>
          {info.canUpdate && (
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => setPending(info)}>
              {t("cliUpdate.update")}
            </button>
          )}
        </div>
      ))}
      {error && (
        <p className="cli-update__error" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <ConfirmDialog
          title={t("cliUpdate.confirmTitle", { name: PROVIDER_LABELS[pending.provider] })}
          body={t("cliUpdate.confirmBody")}
          confirmLabel={t("cliUpdate.confirm")}
          onConfirm={() => void update(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
