import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { Dialog } from "../../ui/Dialog";
import { CatalogPicker } from "./CatalogPicker";
import { ExtensionPage } from "./ExtensionPage";
import {
  addMcpSource,
  installMcpFromCatalog,
  listMcpServers,
  listMcpSources,
  loadMcpCatalog,
  MCP_CHANGED,
  reconfigureMcpServer,
  removeMcpServer,
  removeMcpSource,
  saveMcpServer,
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

/// Nomes de variável separados por vírgula ou espaço. Só o nome: o valor é definido no ambiente do usuário.
function parseNames(text: string): string[] {
  const names = text.split(/[\s,]+/).filter(Boolean);
  for (const name of names) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Nome de variável inválido: "${name}". Use letras, números e _.`);
  }
  return names;
}

/// Campos do formulário manual. Argumentos separados por espaço; variáveis por nome, sem valor.
interface ManualForm {
  name: string;
  transport: "stdio" | "http";
  command: string;
  args: string;
  url: string;
  envVars: string;
}

const EMPTY_FORM: ManualForm = { name: "", transport: "stdio", command: "", args: "", url: "", envVars: "" };

/// Servidores MCP: ferramentas extras que o Claude Code e o Codex podem usar. Cada um roda um programa
/// no seu computador (ou fala com um endereço), por isso a instalação mostra o comando antes de gravar.
/// Segredos: o app grava só o nome da variável. O valor fica no ambiente do Windows e nunca passa pela tela.
export function McpSection() {
  const [tab, setTab] = useState<Tab>("installed");
  const [installed, setInstalled] = useState<McpServer[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  /** Catálogo escolhido: "" é o oficial. */
  const [source, setSource] = useState("");
  const [catalog, setCatalog] = useState<McpCatalogEntry[] | undefined>(undefined);
  const [deleting, setDeleting] = useState<McpServer | undefined>(undefined);
  const [installing, setInstalling] = useState<McpCatalogEntry | undefined>(undefined);
  const [understood, setUnderstood] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<ManualForm>(EMPTY_FORM);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  /** Erro da janela aberta (instalar ou adicionar), para não repetir o da página. */
  const [dialogError, setDialogError] = useState<string | undefined>(undefined);

  async function reloadInstalled() {
    try {
      setInstalled(await listMcpServers());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void reloadInstalled();
    listMcpSources()
      .then(setSources)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    setCatalog(undefined);
    loadMcpCatalog(source || undefined)
      .then((c) => setCatalog(c.servers))
      .catch((e) => setError(String(e)));
  }, [source]);

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

  async function reconfigure(server: McpServer) {
    setError(undefined);
    try {
      await reconfigureMcpServer(server.name);
      setStatus(`${server.name} reconfigurado: agora lê ${server.literalEnv.join(", ")} do ambiente, sem valor gravado.`);
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
    setUnderstood(false);
    setDialogError(undefined);
    setInstalling(entry);
  }

  async function install(entry: McpCatalogEntry) {
    setDialogError(undefined);
    try {
      await installMcpFromCatalog(entry.id, source || undefined);
      setInstalling(undefined);
      setStatus(`${entry.name} instalado nas duas CLIs. Defina as variáveis no ambiente e reinicie o app.`);
      announceChange();
      await reloadInstalled();
    } catch (e) {
      setDialogError(String(e));
    }
  }

  function openManual() {
    setForm(EMPTY_FORM);
    setUnderstood(false);
    setDialogError(undefined);
    setAdding(true);
  }

  async function saveManual() {
    setDialogError(undefined);
    try {
      const envVars = parseNames(form.envVars);
      const args = form.args.split(/\s+/).filter(Boolean);
      await saveMcpServer({
        name: form.name.trim(),
        transport: form.transport,
        command: form.transport === "stdio" ? form.command.trim() : undefined,
        args: form.transport === "stdio" ? args : [],
        url: form.transport === "http" ? form.url.trim() : undefined,
        envVars,
      });
      setAdding(false);
      setStatus(`${form.name.trim()} adicionado nas duas CLIs. Vale na próxima conversa.`);
      announceChange();
      await reloadInstalled();
    } catch (e) {
      setDialogError(String(e));
    }
  }

  async function addSource(url: string) {
    const urls = await addMcpSource(url);
    setSources(urls);
    setSource(url);
    setStatus("Catálogo adicionado e conferido.");
  }

  async function removeSource(url: string) {
    try {
      setSources(await removeMcpSource(url));
      setStatus("Catálogo removido.");
    } catch (e) {
      setError(String(e));
    }
  }

  const installedNames = new Set(installed.map((s) => s.name));
  const manualReady =
    form.name.trim() !== "" &&
    (form.transport === "stdio" ? form.command.trim() !== "" : form.url.trim() !== "") &&
    understood;

  return (
    <ExtensionPage
      title="MCP"
      description="Servidores MCP dão ferramentas extras ao agente, como memória ou acesso ao GitHub. Eles são gravados nas configurações do Claude Code e do Codex, então valem em todas as conversas e no terminal."
      actions={
        <button type="button" className="btn btn--sm" onClick={openManual}>
          Adicionar MCP
        </button>
      }
      tabs={[
        { id: "installed", label: "Instalados" },
        { id: "market", label: "Marketplace" },
      ]}
      tab={tab}
      onTab={(id) => setTab(id as Tab)}
      status={status}
      error={error}
    >
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
                {s.envVars.length > 0 && (
                  <p className="settings-card__meta">Variáveis lidas do ambiente: {s.envVars.join(", ")}</p>
                )}
                {s.literalEnv.length > 0 && (
                  <p role="alert" className="message__error">
                    Segredo gravado em texto nas configurações: {s.literalEnv.join(", ")}. Defina a variável no ambiente e clique em
                    Reconfigurar. Desligar e ligar ficam bloqueados até lá.
                  </p>
                )}
                <div className="settings-actions">
                  {s.literalEnv.length > 0 ? (
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => void reconfigure(s)}>
                      Reconfigurar
                    </button>
                  ) : (
                    <button type="button" className="btn btn--sm" onClick={() => void toggle(s)}>
                      {s.enabled ? "Desligar" : "Ligar"}
                    </button>
                  )}
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
          <CatalogPicker
            sources={sources}
            value={source}
            onChange={setSource}
            onAdd={addSource}
            onRemove={removeSource}
          />
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
            {installing.env.length > 0 && (
              <>
                <p className="settings__hint">
                  O servidor lê estas variáveis do seu ambiente. Defina-as nas variáveis de ambiente do usuário no Windows e
                  reinicie o app. O LunaHarness não pede nem guarda o valor.
                </p>
                <ul>
                  {installing.env.map((field) => (
                    <li key={field.key}>
                      <code>{field.key}</code>: {field.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <label className="settings__check">
              <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
              Entendo que este servidor roda esse comando no meu computador.
            </label>
            {dialogError && (
              <p role="alert" className="message__error">
                {dialogError}
              </p>
            )}
            <div className="api-form__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setInstalling(undefined)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!understood}
                onClick={() => void install(installing)}
              >
                Instalar
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {adding && (
        <Dialog
          title="Adicionar MCP"
          description="Informe o comando (servidor local) ou o endereço (servidor remoto). Ele é gravado nas duas CLIs."
          onClose={() => setAdding(false)}
        >
          <div className="api-form">
            <label>
              Nome
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Tipo
              <select
                aria-label="Tipo"
                value={form.transport}
                onChange={(e) => setForm({ ...form, transport: e.target.value as "stdio" | "http" })}
              >
                <option value="stdio">Local (comando)</option>
                <option value="http">Remoto (endereço https)</option>
              </select>
            </label>
            {form.transport === "stdio" ? (
              <>
                <label>
                  Comando
                  <input value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })} />
                </label>
                <label>
                  Argumentos (separados por espaço)
                  <input value={form.args} onChange={(e) => setForm({ ...form, args: e.target.value })} />
                </label>
              </>
            ) : (
              <label>
                Endereço (https)
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </label>
            )}
            {form.transport === "stdio" && (
              <label>
                Variáveis lidas do ambiente (só os nomes, separados por vírgula)
                <input
                  aria-label="Variáveis do ambiente"
                  placeholder="TOKEN_X, OUTRA_VAR"
                  value={form.envVars}
                  onChange={(e) => setForm({ ...form, envVars: e.target.value })}
                />
              </label>
            )}
            <label className="settings__check">
              <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
              Entendo que este servidor roda esse comando no meu computador.
            </label>
            {dialogError && (
              <p role="alert" className="message__error">
                {dialogError}
              </p>
            )}
            <div className="api-form__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn--primary" disabled={!manualReady} onClick={() => void saveManual()}>
                Adicionar
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
    </ExtensionPage>
  );
}
