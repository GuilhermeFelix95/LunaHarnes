import { useState } from "react";
import { parseShareCode, shareCode, type SavedTheme } from "../../themeShare";
import { t } from "../../i18n";

interface SavedThemesProps {
  /** Tema que está sendo editado agora. Compartilhar gera o código dele. */
  active: SavedTheme | null;
  /** Recebe um tema importado de um código: a tela salva e aplica. */
  onImport: (theme: SavedTheme) => void;
}

/// Compartilhar o tema ativo e importar um código recebido. A lista dos temas fica nos cartões acima.
export function SavedThemes({ active, onImport }: SavedThemesProps) {
  const [importText, setImportText] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [code, setCode] = useState<string | undefined>(undefined);

  function share() {
    if (!active) return;
    setCode(shareCode(active));
    setStatus(undefined);
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setStatus(t("themes.copied"));
    } catch {
      setStatus(t("themes.copyFailed"));
    }
  }

  function importCode() {
    const imported = parseShareCode(importText.trim());
    if (!imported) {
      setError(t("themes.invalidCode"));
      return;
    }
    onImport(imported);
    setImportText("");
    setError(undefined);
    setStatus(t("themes.imported", { name: imported.name }));
  }

  return (
    <div className="saved-themes">
      <h3 className="settings__sub">{t("themes.shareTitle")}</h3>
      <p className="settings__hint">{t("themes.shareHelp")}</p>

      <div className="api-form__actions">
        <button type="button" disabled={!active} onClick={share}>
          {t("themes.generate")}
        </button>
      </div>
      {code && (
        <div className="saved-themes__share">
          <label>
            {t("themes.codeLabel")}
            <textarea aria-label={t("themes.codeLabel")} readOnly rows={4} value={code} />
          </label>
          <div className="api-form__actions">
            <button type="button" onClick={() => void copy()}>
              {t("themes.copy")}
            </button>
          </div>
        </div>
      )}

      <div className="saved-themes__import">
        <label>
          {t("themes.importLabel")}
          <textarea aria-label={t("themes.importAria")} rows={3} value={importText} onChange={(e) => setImportText(e.target.value)} />
        </label>
        <div className="api-form__actions">
          <button type="button" disabled={!importText.trim()} onClick={importCode}>
            {t("themes.import")}
          </button>
        </div>
      </div>

      {status && <p role="status" className="settings__hint">{status}</p>}
      {error && <p role="alert" className="message__error">{error}</p>}
    </div>
  );
}
