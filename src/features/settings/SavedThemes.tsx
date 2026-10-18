import { useState } from "react";
import { parseShareCode, shareCode, type SavedTheme } from "../../themeShare";

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
      setStatus("Código copiado.");
    } catch {
      setStatus("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  }

  function importCode() {
    const imported = parseShareCode(importText.trim());
    if (!imported) {
      setError("Esse código não é um tema do LunaHarness.");
      return;
    }
    onImport(imported);
    setImportText("");
    setError(undefined);
    setStatus(`Tema "${imported.name}" importado.`);
  }

  return (
    <div className="saved-themes">
      <h3 className="settings__sub">Compartilhar e importar</h3>
      <p className="settings__hint">Compartilhe o código de um tema com outra pessoa, que o importa aqui.</p>

      <div className="api-form__actions">
        <button type="button" disabled={!active} onClick={share}>
          Gerar código do tema atual
        </button>
      </div>
      {code && (
        <div className="saved-themes__share">
          <label>
            Código do tema
            <textarea aria-label="Código do tema" readOnly rows={4} value={code} />
          </label>
          <div className="api-form__actions">
            <button type="button" onClick={() => void copy()}>
              Copiar código
            </button>
          </div>
        </div>
      )}

      <div className="saved-themes__import">
        <label>
          Importar um código recebido
          <textarea aria-label="Código para importar" rows={3} value={importText} onChange={(e) => setImportText(e.target.value)} />
        </label>
        <div className="api-form__actions">
          <button type="button" disabled={!importText.trim()} onClick={importCode}>
            Importar tema
          </button>
        </div>
      </div>

      {status && <p role="status" className="settings__hint">{status}</p>}
      {error && <p role="alert" className="message__error">{error}</p>}
    </div>
  );
}
