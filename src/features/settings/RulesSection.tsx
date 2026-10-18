import { useEffect, useState } from "react";
import { getRules, importRules, saveRules } from "../../api";

/// Regras globais: o CLAUDE.md que vale para qualquer CLI. Ao salvar, o texto vai para os arquivos das CLIs.
export function RulesSection() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRules()
      .then(setText)
      .catch((e) => setStatus(String(e)));
  }, []);

  async function save() {
    setBusy(true);
    try {
      const files = await saveRules(text);
      setStatus(`Gravado em ${files.join(" e ")}. A versão anterior de cada arquivo ficou em um .bak ao lado.`);
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function importFromClaude() {
    setBusy(true);
    try {
      setText(await importRules());
      setStatus("Importado de ~/.claude/CLAUDE.md. Clique em Salvar para gravar nas CLIs.");
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings__section" aria-labelledby="settings-rules">
      <h2 id="settings-rules">Regras globais</h2>
      <p className="settings__hint">
        Cole aqui o seu CLAUDE.md. Ao salvar, a Luna grava o texto em ~/.claude/CLAUDE.md e ~/.codex/AGENTS.md, entre
        marcadores, e não mexe no que já estiver fora deles. Perfis de API recebem o mesmo texto em cada pedido.
      </p>
      <textarea
        className="rules__text"
        aria-label="Regras globais"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
      <div className="settings-actions">
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={importFromClaude}>
          Importar do CLAUDE.md
        </button>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={save}>
          Salvar regras
        </button>
      </div>
      {status && (
        <p className="settings__hint" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
