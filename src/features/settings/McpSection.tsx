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
import { t } from "../../i18n";

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
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(t("mcp.invalidVarName", { name }));
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
      .catch((e) => {
        // Sem lista vazia, a dica "Carregando catálogo…" ficaria para sempre.
        setCatalog([]);
        setError(String(e));
      });
  }, [source]);

  async function toggle(server: McpServer) {
    setError(undefined);
    try {
      await setMcpEnabled(server.name, !server.enabled);
      setStatus(server.enabled ? t("mcp.turnedOff", { name: server.name }) : t("mcp.turnedOn", { name: server.name }));
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
      setStatus(t("mcp.reconfigured", { name: server.name, vars: server.literalEnv.join(", ") }));
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
      setStatus(t("mcp.deleted", { name: server.name }));
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
      setStatus(t("mcp.installed", { name: entry.name }));
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
      setStatus(t("mcp.added", { name: form.name.trim() }));
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
    setStatus(t("common.catalogAdded"));
  }

  async function removeSource(url: string) {
    try {
      setSources(await removeMcpSource(url));
      setStatus(t("common.catalogRemoved"));
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
      description={t("mcp.description")}
      actions={
        <button type="button" className="btn btn--sm" onClick={openManual}>
          {t("mcp.add")}
        </button>
      }
      tabs={[
        { id: "installed", label: t("mcp.tab.installed") },
        { id: "market", label: t("mcp.tab.market") },
      ]}
      tab={tab}
      onTab={(id) => setTab(id as Tab)}
      status={status}
      error={error}
    >
      {tab === "installed" && (
        <>
          {installed.length === 0 && <p className="settings__hint">{t("mcp.noneInstalled")}</p>}
          <ul className="settings-list">
            {installed.map((s) => (
              <li key={s.name} className="settings-card">
                <div className="settings-card__head">
                  <strong>{s.name}</strong>
                  <span className="settings-card__meta">
                    {s.enabled ? t("mcp.onWith", { engines: s.engines.join(t("common.and")) }) : t("mcp.off")} ·{" "}
                    {s.transport === "http" ? t("mcp.remote") : t("mcp.local")}
                  </span>
                </div>
                <code className="settings-card__text">{launchLine(s)}</code>
                {s.envVars.length > 0 && (
                  <p className="settings-card__meta">{t("mcp.envVarsRead", { vars: s.envVars.join(", ") })}</p>
                )}
                {s.literalEnv.length > 0 && (
                  <p role="alert" className="message__error">
                    {t("mcp.secretInPlainText", { vars: s.literalEnv.join(", ") })}
                  </p>
                )}
                <div className="settings-actions">
                  {s.literalEnv.length > 0 ? (
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => void reconfigure(s)}>
                      {t("mcp.reconfigure")}
                    </button>
                  ) : (
                    <button type="button" className="btn btn--sm" onClick={() => void toggle(s)}>
                      {s.enabled ? t("mcp.turnOff") : t("mcp.turnOn")}
                    </button>
                  )}
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => setDeleting(s)}>
                    {t("common.delete")}
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
          {!catalog && <p className="settings__hint">{t("common.loadingCatalog")}</p>}
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
                    {installedNames.has(c.id) ? t("common.installed") : t("common.install")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {installing && (
        <Dialog
          title={t("mcp.installTitle", { name: installing.name })}
          description={t("mcp.installDescription")}
          onClose={() => setInstalling(undefined)}
        >
          <div className="api-form">
            <p className="settings__hint">{t("mcp.commandWillBeWritten")}</p>
            <code className="settings-card__text">{launchLine(installing)}</code>
            {installing.env.length > 0 && (
              <>
                <p className="settings__hint">{t("mcp.envHelp")}</p>
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
              {t("mcp.understood")}
            </label>
            {dialogError && (
              <p role="alert" className="message__error">
                {dialogError}
              </p>
            )}
            <div className="api-form__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setInstalling(undefined)}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!understood}
                onClick={() => void install(installing)}
              >
                {t("common.install")}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {adding && (
        <Dialog
          title={t("mcp.add")}
          description={t("mcp.addDescription")}
          onClose={() => setAdding(false)}
        >
          <div className="api-form">
            <label>
              {t("mcp.field.name")}
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              {t("mcp.field.type")}
              <select
                aria-label={t("mcp.field.type")}
                value={form.transport}
                onChange={(e) => setForm({ ...form, transport: e.target.value as "stdio" | "http" })}
              >
                <option value="stdio">{t("mcp.type.local")}</option>
                <option value="http">{t("mcp.type.remote")}</option>
              </select>
            </label>
            {form.transport === "stdio" ? (
              <>
                <label>
                  {t("mcp.field.command")}
                  <input value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })} />
                </label>
                <label>
                  {t("mcp.field.args")}
                  <input value={form.args} onChange={(e) => setForm({ ...form, args: e.target.value })} />
                </label>
              </>
            ) : (
              <label>
                {t("mcp.field.url")}
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </label>
            )}
            {form.transport === "stdio" && (
              <label>
                {t("mcp.field.envVars")}
                <input
                  aria-label={t("mcp.field.envVarsAria")}
                  placeholder="TOKEN_X, OUTRA_VAR"
                  value={form.envVars}
                  onChange={(e) => setForm({ ...form, envVars: e.target.value })}
                />
              </label>
            )}
            <label className="settings__check">
              <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
              {t("mcp.understood")}
            </label>
            {dialogError && (
              <p role="alert" className="message__error">
                {dialogError}
              </p>
            )}
            <div className="api-form__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)}>
                {t("common.cancel")}
              </button>
              <button type="button" className="btn btn--primary" disabled={!manualReady} onClick={() => void saveManual()}>
                {t("mcp.addButton")}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {deleting && (
        <ConfirmDialog
          title={t("mcp.deleteTitle", { name: deleting.name })}
          body={t("mcp.deleteBody")}
          confirmLabel={t("mcp.deleteConfirm")}
          danger
          onConfirm={() => void remove(deleting)}
          onCancel={() => setDeleting(undefined)}
        />
      )}
    </ExtensionPage>
  );
}
