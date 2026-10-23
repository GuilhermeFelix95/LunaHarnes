import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { siteCloneCapture } from "../../api";
import { buildClonePrompt, checkFolderName, cloneQuestions, parseCloneAnswer, type CloneAnswer } from "../../chat/siteClone";
import type { Permission } from "../../types";
import { t } from "../../i18n";
import { QuestionPicker } from "./QuestionPicker";

interface SiteCloneFlowProps {
  permission: Permission;
  onPermission: (permission: Permission) => void;
  /** Manda o pedido ao agente: `shown` é o que aparece no chat, `prompt` é o texto completo, `folder` é a pasta do clone (null no projeto atual). */
  onSend: (shown: string, prompt: string, folder: string | null) => void;
  onClose: () => void;
}

/// Fluxo do clonador no chat: primeiro o destino e o que copiar (seletor de perguntas), depois endereço e aviso.
/// Só pede a pasta quando o clone vai para uma subpasta. Nada é enviado com a permissão de só leitura.
export function SiteCloneFlow({ permission, onPermission, onSend, onClose }: SiteCloneFlowProps) {
  const [answer, setAnswer] = useState<CloneAnswer | null>(null);
  const [folder, setFolder] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const readOnly = permission === "readOnly";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!answer || busy || readOnly) return;
    let folderName: string | null = null;
    if (!answer.inProject) {
      const check = checkFolderName(folder);
      if (!check.ok) {
        setError(check.reason);
        return;
      }
      folderName = check.name;
    }
    let target: string;
    try {
      target = new URL(url.trim()).toString();
    } catch {
      setError(t("clone.error.url"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const capture = await siteCloneCapture(target, true);
      const prompt = buildClonePrompt({ url: target, folder: folderName, parts: answer.parts, capture });
      const shown = folderName ? t("clone.shown", { url: target, folder: folderName }) : t("clone.shownProject", { url: target });
      onSend(shown, prompt, folderName);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (answer === null) {
    return (
      <QuestionPicker
        questions={cloneQuestions()}
        onAnswer={(text) => setAnswer(parseCloneAnswer(text))}
        onDismiss={onClose}
      />
    );
  }

  return (
    <section className="qpick clone-flow" aria-label={t("composer.clone")}>
      <header className="qpick__head">
        <span className="qpick__title">{t("composer.clone")}</span>
        <button type="button" className="qpick__close" aria-label={t("clone.cancel")} onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </button>
      </header>
      <form className="clone-flow__form" onSubmit={submit}>
        {!answer.inProject && (
          <label className="clone__field">
            <span>{t("clone.folder")}</span>
            <input value={folder} onChange={(e) => setFolder(e.target.value)} />
          </label>
        )}
        <label className="clone__field">
          <span>{t("clone.url")}</span>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" required />
        </label>
        <p className="clone__warning">{t("clone.warning")}</p>
        {readOnly && (
          <p className="clone-flow__notice" role="status">
            {t("clone.readOnlyNotice")}{" "}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onPermission("acceptEdits")}>
              {t("clone.switchPermission")}
            </button>
          </p>
        )}
        {error && <p className="clone__error" role="alert">{error}</p>}
        <div className="qpick__foot">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAnswer(null)}>
            {t("clone.back")}
          </button>
          <button type="submit" className="btn btn--primary btn--sm" disabled={busy || readOnly}>
            {busy ? t("clone.capturing") : t("clone.capture")}
          </button>
        </div>
      </form>
    </section>
  );
}
