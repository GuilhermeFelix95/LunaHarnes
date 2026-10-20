import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import { readProjectFile, writeProjectFile } from "../../api";
import { t } from "../../i18n";

/// Preferência de auto-salvar, por pessoa (localStorage). Some se o navegador bloquear o armazenamento.
export const AUTO_SAVE_KEY = "luna.fileEditor.autoSave";
/// Espera depois da última tecla antes de gravar sozinho.
const AUTO_SAVE_DELAY_MS = 800;

function loadAutoSave(): boolean {
  try {
    return localStorage.getItem(AUTO_SAVE_KEY) === "on";
  } catch {
    return false;
  }
}

function saveAutoSave(on: boolean) {
  try {
    localStorage.setItem(AUTO_SAVE_KEY, on ? "on" : "off");
  } catch {
    // Sem armazenamento a preferência vale só nesta sessão.
  }
}

interface FileEditorProps {
  cwd: string;
  /** Caminho relativo à pasta do projeto. */
  path: string;
  /** Volta ao chat. Quem chama desmonta o editor. */
  onClose: () => void;
}

/// Editor de texto do arquivo, no lugar do chat (como o VS Code, em versão simples).
/// Salva com o botão ou Ctrl+S; com auto-salvar ligado, grava sozinho pouco depois de parar de digitar.
export function FileEditor({ cwd, path, onClose }: FileEditorProps) {
  // `saved` é o último texto gravado; `text` é o que está na tela. Diferentes = alterações não salvas.
  const [loaded, setLoaded] = useState<{ text: string; saved: string } | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [autoSave, setAutoSave] = useState(loadAutoSave);

  useEffect(() => {
    let alive = true;
    readProjectFile(cwd, path).then(
      (content) => alive && setLoaded({ text: content, saved: content }),
      (e) => alive && setError(t("files.loadError", { error: String(e) })),
    );
    return () => {
      alive = false;
    };
  }, [cwd, path]);

  const dirty = loaded !== null && loaded.text !== loaded.saved;

  async function save(value: string) {
    setBusy(true);
    setError(undefined);
    try {
      await writeProjectFile(cwd, path, value);
      setLoaded((current) => current && { text: current.text, saved: value });
    } catch (e) {
      setError(t("files.saveError", { error: String(e) }));
    } finally {
      setBusy(false);
    }
  }

  // Auto-salvar: grava depois de uma pausa na digitação. Uma falha não repete sozinha (só ao digitar de novo).
  useEffect(() => {
    if (!autoSave || !dirty || !loaded) return;
    const timer = window.setTimeout(() => void save(loaded.text), AUTO_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoSave, dirty, loaded?.text]);

  function toggleAutoSave(on: boolean) {
    setAutoSave(on);
    saveAutoSave(on);
  }

  function close() {
    if (dirty && !window.confirm(t("files.discardConfirm"))) return;
    onClose();
  }

  return (
    <section
      className="file-editor"
      aria-label={path}
      onKeyDown={(event) => {
        // Ctrl+S (ou Cmd+S) grava na hora, mesmo com o foco no texto.
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          if (dirty && !busy && loaded) void save(loaded.text);
        }
      }}
    >
      <header className="file-editor__head">
        <span className="file-editor__path" title={path}>
          {path}
        </span>
        <span className="file-editor__status" aria-live="polite">
          {busy ? t("files.saving") : dirty ? t("files.unsaved") : t("files.saved")}
        </span>
        <label className="file-editor__auto">
          <input type="checkbox" checked={autoSave} onChange={(event) => toggleAutoSave(event.target.checked)} />
          <span>{t("files.autoSave")}</span>
        </label>
        <button type="button" className="btn btn--ghost btn--sm" disabled={!dirty || busy} onClick={() => loaded && void save(loaded.text)}>
          <Save size={14} aria-hidden="true" />
          <span>{t("files.save")}</span>
        </button>
        <button type="button" className="file-editor__close" aria-label={t("files.close")} onClick={close}>
          <X size={14} aria-hidden="true" />
        </button>
      </header>
      {error && (
        <p role="alert" className="files__error">
          {error}
        </p>
      )}
      {loaded ? (
        <textarea
          className="file-editor__text"
          aria-label={path}
          spellCheck={false}
          value={loaded.text}
          onChange={(event) => setLoaded((current) => current && { ...current, text: event.target.value })}
        />
      ) : (
        !error && <p className="files__empty">{t("files.reading")}</p>
      )}
    </section>
  );
}
