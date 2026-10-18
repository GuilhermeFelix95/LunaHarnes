import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { Dialog } from "../../ui/Dialog";
import {
  installMcpFromCatalog,
  listMcpServers,
  loadMcpCatalog,
  MCP_CHANGED,
  removeMcpServer,
  setMcpEnabled,
  type McpCatalogEntry,
  type McpServer,
} from "../../api";

type Tab = "installed" | "market";

function announceChange() {
  window.dispatchEvent(new Event(MCP_CHANGED));
}

/// O comando exato que o servidor roda (ou a URL), como o usuário vai ver no diálogo de instalação.
function launchLine(server: { transport: string; command?: string; args: string[]; url?: string }): string {
  if (server.transport === "http") return server.url ?? "";
  return [server.command, ...server.args].filter(Boolean).join(" ");
}

/// Servidores MCP: ferramentas extras que o Claude Code e o Codex podem usar. Cada um roda um programa
/// no seu computador (ou fala com um endereço), por isso a instalação mostra o comando antes de gravar.
export function McpSection() {
  const [tab, setTab] = useState<Tab>("installed");
  const [installed, setInstalled] = useState<McpServer[]>([]);
  const [catalog, setCatalog] = useState<McpCatalogEntry[] | undefined>(undefined);
  const [deleting, setDeleting] = useState<McpServer | undefined>(undefined);
  const [installing, setInstalling] = useState<McpCatalogEntry | undefined>(undefined);
  const [values, setValues] = useState<Record<string, string>>({});
  const [understood, setUnderstood] = useState(false);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  async function reloadInstalled() {
    try {
      setInstalled(await listMcpServers());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void reloadInstalled();
    loadMcpCatalog()
      .then((c) => setCatalog(c.servers))
      .catch((e) => setError(String(e)));
  }, []);

  async function toggle(server: McpServer) {
    setError(undefined);
    try {
      await setMcpEnabled(server.name, !server.enabled);
      setStatus(server.enabled ? `${server.name} desligado.` : `${server.name} ligado.`);
      announceChange();
      await reloadInstalled();
    } catch (e) {
      setError(String(e));
    }
  }

  async function remove(server: McpServer) {
    setError(undefined);
    try {
      await removeMcpServer(server.name);
      setDeleting(undefined);
      setStatus(`${server.name} excluído.`);
      announceChange();
      await reloadInstalled();
    } catch (e) {
      setError(String(e));
    }
  }

  function openInstall(entry: McpCatalogEntry) {
    setValues({});
    setUnderstood(false);
    setError(undefined);
    setInstalling(entry);
  }

  async function install(entry: McpCatalogEntry) {
    setError(undefined);
    try {
      await installMcpFromCatalog(entry.id, values);
      setInstalling(undefined);
      setStatus(`${entry.name} instalado nas duas CLIs. Vale na próxima conversa.`);
      announceChange();
      await reloadInstalled();
    } catch (e) {
      setError(String(e));
    }
  }

  const installedNames = new Set(installed.map((s) => s.name));
  const needsValues = installing?.env.some((f) => !(values[f.key] ?? "").trim()) ?? false;

  return (
    <section className="settings__section" aria-labelledby="settings-mcp">
      <header className="settings__section-head">
        <div>
          <h2 id="settings-mcp">MCP</h2>
          <p className="settings__hint">
            Servidores MCP dão ferramentas extras ao agente, como memória ou acesso ao GitHub. Eles são gravados nas
            configurações do Claude Code e do Codex, então valem em todas as conversas e no terminal.
          </p>
        </div>
      </header>

      <div className="segmented" role="tablist" aria-label="MCP">
        <button type="button" role="tab" aria-selected={tab === "installed"} onClick={() => setTab("installed")}>
          Instalados
        </button>
        <button type="button" role="tab" aria-selected={tab === "market"} onClick={() => setTab("market")}>
          Marketplace
        </button>
      </div>

      {status && (
        <p role="status" className="settings__hint">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="message__error">
          {error}
        </p>
      )}

      {tab === "installed" && (
        <>
          {installed.length === 0 && <p className="settings__hint">Nenhum servidor MCP instalado. Veja o Marketplace.</p>}
          <ul className="settings-list">
            {installed.map((s) => (
              <li key={s.name} className="settings-card">
                <div className="settings-card__head">
                  <strong>{s.name}</strong>
                  <span className="settings-card__meta">
                    {s.enabled ? `ligado · ${s.engines.join(" e ")}` : "desligado"} · {s.transport === "http" ? "remoto" : "local"}
                  </span>
                </div>
                <code className="settings-card__text">{launchLine(s)}</code>
                <div className="settings-actions">
                  <button type="button" className="btn btn--sm" onClick={() => void toggle(s)}>
                    {s.enabled ? "Desligar" : "Ligar"}
                  </button>
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => setDeleting(s)}>
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === "market" && (
        <>
          {!catalog && <p className="settings__hint">Carregando catálogo…</p>}
          <ul className="settings-list">
            {catalog?.map((c) => (
              <li key={c.id} className="settings-card">
                <div className="settings-card__head">
                  <strong>{c.name}</strong>
                  <span className="settings-card__meta">{c.author}</span>
                </div>
                <p className="settings-card__text">{c.description}</p>
                <code className="settings-card__text">{launchLine(c)}</code>
                <div className="settings-actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={installedNames.has(c.id)}
                    onClick={() => openInstall(c)}
                  >
                    {installedNames.has(c.id) ? "Instalado" : "Instalar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {installing && (
        <Dialog
          title={`Instalar ${installing.name}?`}
          description="Confira o comando exato antes de instalar. Um servidor MCP roda este comando no seu computador."
          onClose={() => setInstalling(undefined)}
        >
          <div className="api-form">
            <p className="settings__hint">Comando que será gravado nas duas CLIs:</p>
            <code className="settings-card__text">{launchLine(installing)}</code>
            {installing.env.map((field) => (
              <label key={field.key}>
                {field.label}
                <input
                  type="password"
                  autoComplete="off"
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                />
              </label>
            ))}
            <label className="settings__check">
              <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
              Entendo que este servidor roda esse comando no meu computador.
            </label>
            {error && (
              <p role="alert" className="message__error">
                {error}
              </p>
            )}
            <div className="api-form__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setInstalling(undefined)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!understood || needsValues}
                onClick={() => void install(installing)}
              >
                Instalar
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Excluir ${deleting.name}?`}
          body="O servidor sai das duas CLIs e a configuração guardada para ligar depois também é apagada."
          confirmLabel="Excluir servidor"
          danger
          onConfirm={() => void remove(deleting)}
          onCancel={() => setDeleting(undefined)}
        />
      )}
    </section>
  );
}
