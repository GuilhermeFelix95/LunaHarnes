import { useState, type FormEvent } from "react";
import { Dialog } from "../../ui/Dialog";

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
        Catálogo
        <select aria-label="Catálogo" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">LunaHarness oficial</option>
          {sources.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn btn--sm" onClick={() => setAdding(true)}>
        Adicionar catálogo
      </button>
      {value && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => void onRemove(value).then(() => onChange(""))}>
          Remover catálogo
        </button>
      )}

      {adding && (
        <Dialog
          title="Adicionar catálogo"
          description="Um catálogo é um arquivo JSON publicado em https. Ele é conferido antes de ser guardado."
          onClose={() => setAdding(false)}
        >
          <form className="api-form" onSubmit={(e) => void submit(e)}>
            <label>
              Endereço do catálogo (https)
              <input
                aria-label="Endereço do catálogo"
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
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary">
                Adicionar
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
