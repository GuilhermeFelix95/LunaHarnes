import { useState } from "react";
import type { ThemePalette } from "../../theme";
import { loadSavedThemes, parseShareCode, saveSavedThemes, shareCode, type SavedTheme } from "../../themeShare";

interface SavedThemesProps {
  /** Cores que estão sendo editadas agora: é o que "Salvar" grava. */
  palette: ThemePalette;
  onApply: (palette: ThemePalette) => void;
}

/// Temas personalizados salvos com nome, com ações de aplicar, compartilhar e excluir, e importação de um código.
export function SavedThemes({ palette, onApply }: SavedThemesProps) {
  const [themes, setThemes] = useState<SavedTheme[]>(loadSavedThemes);
  const [name, setName] = useState("");
  const [sharing, setSharing] = useState<{ name: string; code: string } | null>(null);
  const [importText, setImportText] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  /// Grava a lista; um tema com o mesmo nome é substituído.
  function store(next: SavedTheme[]) {
    setThemes(next);
    saveSavedThemes(next);
  }

  function save() {
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Dê um nome ao tema antes de salvar.");
      return;
    }
    store([...themes.filter((t) => t.name !== cleanName), { name: cleanName, palette }]);
    setName("");
    setError(undefined);
    setStatus(`Tema "${cleanName}" salvo.`);
  }

  function remove(target: SavedTheme) {
    store(themes.filter((t) => t.name !== target.name));
    if (sharing?.name === target.name) setSharing(null);
    setStatus(`Tema "${target.name}" excluído.`);
  }

  async function copy(code: string) {
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
    store([...themes.filter((t) => t.name !== imported.name), imported]);
    setImportText("");
    setError(undefined);
    setStatus(`Tema "${imported.name}" importado.`);
  }

  return (
    <div className="saved-themes">
      <h3 className="settings__sub">Temas salvos</h3>
      <p className="settings__hint">Salve as cores atuais com um nome. Compartilhe o código com outra pessoa, que o importa aqui.</p>

      <div className="api-form__actions">
        <input
          aria-label="Nome do tema"
          placeholder="Nome do tema"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="button" onClick={save}>
          Salvar tema atual
        </button>
      </div>

      {themes.length === 0 && <p className="settings__hint">Nenhum tema salvo ainda.</p>}
      <ul className="profiles">
        {themes.map((t) => (
          <li key={t.name} className="profile">
            <div className="profile__head">
              <strong>{t.name}</strong>
            </div>
            <div className="profile__actions">
              <button type="button" aria-label={`Aplicar ${t.name}`} onClick={() => onApply(t.palette)}>
                Aplicar
              </button>
              <button type="button" aria-label={`Compartilhar ${t.name}`} onClick={() => setSharing({ name: t.name, code: shareCode(t) })}>
                Compartilhar
              </button>
              <button type="button" aria-label={`Excluir ${t.name}`} onClick={() => remove(t)}>
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>

      {sharing && (
        <div className="saved-themes__share">
          <label>
            Código de "{sharing.name}"
            <textarea aria-label="Código do tema" readOnly rows={4} value={sharing.code} />
          </label>
          <div className="api-form__actions">
            <button type="button" onClick={() => void copy(sharing.code)}>
              Copiar código
            </button>
          </div>
        </div>
      )}

      <div className="saved-themes__import">
        <label>
          Importar um código recebido
          <textarea
            aria-label="Código para importar"
            rows={3}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
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
