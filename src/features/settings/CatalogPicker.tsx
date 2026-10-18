import { useState, type FormEvent } from "react";
import { Dialog } from "../../ui/Dialog";
import { t } from "../../i18n";

interface CatalogPickerProps {
  /** Catálogos por URL que o usuário adicionou. */
  sources: string[];
  /** "" = catálogo oficial. */
  value: string;
  onChange: (source: string) => void;
  /** Baixa, confere e guarda a URL. Lança erro com a mensagem para mostrar. */
  onAdd: (url: string) => Promise<void>;
  onRemove: (url: string) => Promise<void>;
}

/// Escolha do catálogo de uma extensão: o oficial ou um adicionado por URL. Adicionar abre uma janela.
export function CatalogPicker({ sources, value, onChange, onAdd, onRemove }: CatalogPickerProps) {
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    try {
      await onAdd(url.trim());
      setUrl("");
      setAdding(false);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="settings-actions">
      <label className="settings-field">
        {t("catalog.label")}
        <select aria-label={t("catalog.label")} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t("catalog.official")}</option>
          {sources.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn btn--sm" onClick={() => setAdding(true)}>
        {t("catalog.add")}
      </button>
      {value && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => void onRemove(value).then(() => onChange(""))}>
          {t("catalog.remove")}
        </button>
      )}

      {adding && (
        <Dialog
          title={t("catalog.add")}
          description={t("catalog.addDescription")}
          onClose={() => setAdding(false)}
        >
          <form className="api-form" onSubmit={(e) => void submit(e)}>
            <label>
              {t("catalog.addressLabel")}
              <input
                aria-label={t("catalog.addressAria")}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://exemplo.com/catalogo.json"
                required
              />
            </label>
            {error && (
              <p role="alert" className="message__error">
                {error}
              </p>
            )}
            <div className="api-form__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)}>
                {t("common.cancel")}
              </button>
              <button type="submit" className="btn btn--primary">
                {t("common.add")}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
