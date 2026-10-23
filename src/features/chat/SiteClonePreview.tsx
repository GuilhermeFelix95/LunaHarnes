import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { readProjectFile } from "../../api";
import { t } from "../../i18n";

interface SiteClonePreviewProps {
  cwd: string;
  /** Subpasta do clone, dentro do projeto. */
  folder: string;
  onClose: () => void;
}

/// Prévia do site gerado: mostra o `index.html` da subpasta num iframe sem acesso ao app.
/// O `sandbox` sem `allow-same-origin` deixa o clone sem cookies, storage ou chamadas com a sessão do app.
export function SiteClonePreview({ cwd, folder, onClose }: SiteClonePreviewProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    readProjectFile(cwd, `${folder}/index.html`).then(
      (content) => {
        if (!alive) return;
        setHtml(content);
        setMissing(false);
      },
      () => {
        if (!alive) return;
        setHtml(null);
        setMissing(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [cwd, folder, version]);

  return (
    <section className="qpick clone-preview" aria-label={t("clone.preview")}>
      <header className="qpick__head">
        <span className="qpick__title">
          {t("clone.preview")} <span className="qpick__count">{folder}/</span>
        </span>
        <div className="clone-preview__actions">
          <button type="button" className="qpick__close" aria-label={t("clone.previewRefresh")} onClick={() => setVersion((v) => v + 1)}>
            <RefreshCw size={14} aria-hidden="true" />
          </button>
          <button type="button" className="qpick__close" aria-label={t("clone.previewClose")} onClick={onClose}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </header>
      {html !== null && (
        <iframe className="clone-preview__frame" title={t("clone.preview")} sandbox="allow-scripts" srcDoc={html} />
      )}
      {missing && <p className="clone-preview__empty">{t("clone.previewMissing")}</p>}
    </section>
  );
}
