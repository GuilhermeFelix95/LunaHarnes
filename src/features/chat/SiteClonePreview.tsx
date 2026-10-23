import { useState } from "react";
import { X } from "lucide-react";
import { browserPreviewUrl } from "../../api";
import { t } from "../../i18n";

interface SiteClonePreviewProps {
  cwd: string;
  /** Subpasta do clone, dentro do projeto. */
  folder: string;
  /** Recebe o endereço da prévia e abre numa aba do navegador embutido. */
  onOpen: (url: string) => void;
  onClose: () => void;
}

/// Prévia do clone: a página não aparece no chat. O botão serve a pasta do clone num endereço local do app
/// e abre esse endereço no navegador embutido, como uma navegação comum.
export function SiteClonePreview({ cwd, folder, onOpen, onClose }: SiteClonePreviewProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function open() {
    setBusy(true);
    setError("");
    try {
      onOpen(await browserPreviewUrl(cwd, folder));
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="qpick clone-preview" aria-label={t("clone.preview")}>
      <header className="qpick__head">
        <span className="qpick__title">
          {t("clone.preview")} <span className="qpick__count">{folder}/</span>
        </span>
        <button type="button" className="qpick__close" aria-label={t("clone.previewClose")} onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </button>
      </header>
      <div className="clone-preview__actions">
        <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={() => void open()}>
          {t("clone.previewOpen")}
        </button>
      </div>
      {error && (
        <p className="clone-preview__empty" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
