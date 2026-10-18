import { useEffect, useState, type FormEvent } from "react";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { Dialog } from "../../ui/Dialog";
import {
  addCatalogSource,
  createPlugin,
  installCatalogPlugin,
  installLocalPlugin,
  inspectLocalPlugin,
  openPluginsFolder,
  pickPluginFolder,
  listCatalogSources,
  listPlugins,
  loadCatalog,
  getPluginsState,
  OFFICIAL_SOURCE,
  PLUGINS_CHANGED,
  removeCatalogSource,
  setPluginEnabled,
  uninstallPlugin,
  type Catalog,
  type CatalogPlugin,
} from "../../api";
import type { PluginManifest } from "../../plugins/host";
import { permissionText } from "../../plugins/permissions";
import { Markdown } from "../chat/Markdown";
import guide from "../../../docs/plugins.md?raw";
import { ExtensionPage } from "./ExtensionPage";
import { t } from "../../i18n";

type Tab = "installed" | "market";

/// Versão do catálogo mais nova que a instalada, comparando números (0.10.0 > 0.9.0). Sem instalada, não é atualização.
function isNewerVersion(catalog: string, installed: string | undefined): boolean {
  if (installed === undefined) return false;
  const a = catalog.split(".").map((p) => Number(p) || 0);
  const b = installed.split(".").map((p) => Number(p) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

function announceChange() {
  window.dispatchEvent(new Event(PLUGINS_CHANGED));
}

/// Lista das permissões que um plugin pede, no idioma da interface, para os diálogos de instalação.
function PermissionList({ permissions }: { permissions: string[] }) {
  return (
    <ul className="settings-list__permissions">
      {permissions.map((perm) => (
        <li key={perm}>{permissionText(perm)}</li>
      ))}
    </ul>
  );
}

/// Seção "Plugins": instalados (ligar, desligar, excluir) e marketplace (catálogos oficial e por URL).
/// Criar, instalar de uma pasta e adicionar catálogo abrem em janelas; nada fica aberto no meio da lista.
export function PluginsSection() {
  const [tab, setTab] = useState<Tab>("installed");
  const [installed, setInstalled] = useState<PluginManifest[]>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [scanErrors, setScanErrors] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<PluginManifest | undefined>(undefined);

  const [sources, setSources] = useState<string[]>([]);
  const [source, setSource] = useState(OFFICIAL_SOURCE);
  const [sourceInput, setSourceInput] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | undefined>(undefined);
  const [pending, setPending] = useState<CatalogPlugin | undefined>(undefined);
  /// Plugin de uma pasta escolhida, à espera de confirmação das permissões.
  const [pendingLocal, setPendingLocal] = useState<{ folder: string; manifest: PluginManifest } | undefined>(undefined);
  /// Atualização que pede permissões a mais do que a versão instalada.
  const [pendingUpdate, setPendingUpdate] = useState<{ plugin: CatalogPlugin; added: string[] } | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");

  const [status, setStatus] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  async function reloadInstalled() {
    try {
      const [scan, state] = await Promise.all([listPlugins(), getPluginsState()]);
      setInstalled(scan.plugins);
      setScanErrors(scan.errors.map((e) => `${e.folder}: ${e.message}`));
      setDisabled(state.disabled);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void reloadInstalled();
    listCatalogSources()
      .then(setSources)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (tab !== "market") return;
    setCatalog(undefined);
    loadCatalog(source)
      .then(setCatalog)
      .catch((e) => setError(String(e)));
  }, [tab, source]);

  async function toggle(id: string, enable: boolean) {
    setError(undefined);
    try {
      const state = await setPluginEnabled(id, enable);
      setDisabled(state.disabled);
      setStatus(enable ? t("plugins.enabled") : t("plugins.disabled"));
      announceChange();
    } catch (e) {
      setError(String(e));
    }
  }

  async function remove(id: string) {
    setError(undefined);
    try {
      await uninstallPlugin(id);
      setDeleting(undefined);
      setStatus(t("plugins.deleted"));
      announceChange();
      await reloadInstalled();
    } catch (e) {
      setError(String(e));
    }
  }

  async function install() {
    if (!pending) return;
    setError(undefined);
    try {
      await installCatalogPlugin(source, pending.id);
      setStatus(t("plugins.installed", { name: pending.name }));
      setPending(undefined);
      announceChange();
      await reloadInstalled();
    } catch (e) {
      setError(String(e));
    }
  }

  /// Atualiza o plugin. Se a versão nova pede permissões que a instalada não tinha, confirma antes.
  function update(plugin: CatalogPlugin) {
    const current = installed.find((p) => p.id === plugin.id);
    const added = plugin.permissions.filter((perm) => !(current?.permissions ?? []).includes(perm));
    if (added.length > 0) {
      setPendingUpdate({ plugin, added });
      return;
    }
    void applyUpdate(plugin.id);
  }

  async function applyUpdate(id: string) {
    setError(undefined);
    try {
      await installCatalogPlugin(source, id);
      setPendingUpdate(undefined);
      setStatus(t("plugins.updated"));
      announceChange();
      await reloadInstalled();
    } catch (e) {
      setError(String(e));
    }
  }

  /// Escolhe uma pasta do computador e lê o manifesto, para mostrar as permissões antes de copiar.
  async function chooseLocal() {
    setError(undefined);
    try {
      const folder = await pickPluginFolder();
      if (!folder) return;
      const manifest = await inspectLocalPlugin(folder);
      setPendingLocal({ folder, manifest });
    } catch (e) {
      setError(String(e));
    }
  }

  /// Abre a pasta de plugins no gerenciador de arquivos, para o usuário editar ou copiar plugins.
  async function openFolder() {
    setError(undefined);
    try {
      await openPluginsFolder();
    } catch (e) {
      setError(String(e));
    }
  }

  async function installLocal() {
    if (!pendingLocal) return;
    setError(undefined);
    try {
      await installLocalPlugin(pendingLocal.folder);
      setStatus(t("plugins.installed", { name: pendingLocal.manifest.name }));
      setPendingLocal(undefined);
      announceChange();
      await reloadInstalled();
    } catch (e) {
      setError(String(e));
    }
  }

  /// Cria um plugin com o modelo na pasta de plugins. Ele aparece na lista, pronto para editar.
  async function createNew(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    try {
      const folder = await createPlugin(newId.trim(), newName.trim());
      setNewId("");
      setNewName("");
      setCreating(false);
      setStatus(t("plugins.created", { folder }));
      announceChange();
      await reloadInstalled();
    } catch (err) {
      setError(String(err));
    }
  }

  async function addSource(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const url = sourceInput.trim();
    try {
      // addCatalogSource baixa e confere o catálogo antes de guardar a URL.
      const added = await addCatalogSource(url);
      setSourceInput("");
      setAddingSource(false);
      setSources(await listCatalogSources());
      setSource(url);
      setCatalog(added);
      setStatus(t("plugins.sourceAdded", { name: added.name }));
    } catch (err) {
      setError(String(err));
    }
  }

  async function dropSource() {
    setError(undefined);
    try {
      await removeCatalogSource(source);
      setSources(await listCatalogSources());
      setSource(OFFICIAL_SOURCE);
      setStatus(t("common.catalogRemoved"));
    } catch (err) {
      setError(String(err));
    }
  }

  const installedIds = new Set(installed.map((p) => p.id));
  const installedVersions = new Map(installed.map((p) => [p.id, p.version]));

  return (
    <ExtensionPage
      title="Plugins"
      description={t("plugins.description")}
      actions={
        <>
          <button type="button" className="btn btn--sm" onClick={() => void openFolder()}>
            {t("plugins.openFolder")}
          </button>
          <button type="button" className="btn btn--sm" onClick={() => void chooseLocal()}>
            {t("plugins.installFromFolder")}
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setCreating(true)}>
            {t("plugins.create")}
          </button>
        </>
      }
      tabs={[
        { id: "installed", label: t("skills.tab.installed") },
        { id: "market", label: t("skills.tab.market") },
      ]}
      tab={tab}
      onTab={(id) => setTab(id as Tab)}
      status={status}
      error={error}
    >
      {tab === "installed" && (
        <>
          <p className="settings__hint">{t("plugins.hint")}</p>
          {installed.length === 0 && <p className="settings__hint">{t("plugins.none")}</p>}
          <ul className="settings-list">
            {installed.map((p) => {
              const off = disabled.includes(p.id);
              return (
                <li key={p.id} className="settings-card">
                  <div className="settings-card__head">
                    <strong>{p.name}</strong>
                    <span className="settings-card__meta">
                      v{p.version} · {off ? t("plugins.off") : t("plugins.on")}
                    </span>
                  </div>
                  <p className="settings-card__meta">
                    {t("plugins.permissions", { list: p.permissions.join(", ") || t("plugins.noPermissions") })}
                  </p>
                  <div className="settings-actions">
                    <button type="button" className="btn btn--sm" onClick={() => void toggle(p.id, off)}>
                      {off ? t("plugins.turnOn") : t("plugins.turnOff")}
                    </button>
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => setDeleting(p)}>
                      {t("common.delete")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {scanErrors.map((message) => (
            <p key={message} role="alert" className="message__error">
              {message}
            </p>
          ))}
          <details className="plugin-guide">
            <summary>{t("plugins.guide")}</summary>
            <Markdown text={guide} />
          </details>
        </>
      )}

      {tab === "market" && (
        <>
          <div className="settings-actions">
            <label className="settings-field">
              {t("catalog.label")}
              <select aria-label={t("catalog.label")} value={source} onChange={(e) => setSource(e.target.value)}>
                <option value={OFFICIAL_SOURCE}>{t("catalog.official")}</option>
                {sources.map((url) => (
                  <option key={url} value={url}>
                    {url}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn--sm" onClick={() => setAddingSource(true)}>
              {t("catalog.add")}
            </button>
            {source !== OFFICIAL_SOURCE && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => void dropSource()}>
                {t("catalog.remove")}
              </button>
            )}
          </div>

          {!catalog && <p className="settings__hint">{t("common.loadingCatalog")}</p>}
          {catalog && catalog.plugins.length === 0 && <p className="settings__hint">{t("plugins.catalogEmpty")}</p>}
          <ul className="settings-list">
            {catalog?.plugins.map((p) => (
              <li key={p.id} className="settings-card">
                <div className="settings-card__head">
                  <strong>{p.name}</strong>
                  <span className="settings-card__meta">
                    v{p.version} · {p.author}
                  </span>
                </div>
                <p className="settings-card__text">{p.description}</p>
                <div className="settings-actions">
                  {isNewerVersion(p.version, installedVersions.get(p.id)) ? (
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => update(p)}>
                      {t("plugins.update")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={installedIds.has(p.id)}
                      onClick={() => setPending(p)}
                    >
                      {installedIds.has(p.id) ? t("common.installed") : t("common.install")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {creating && (
        <Dialog
          title={t("plugins.createTitle")}
          description={t("plugins.createDescription")}
          onClose={() => setCreating(false)}
        >
          <form className="api-form" onSubmit={(e) => void createNew(e)}>
            <label>
              {t("plugins.idLabel")}
              <input aria-label={t("plugins.idAria")} value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="meu-plugin" required />
            </label>
            <label>
              {t("common.name")}
              <input aria-label={t("plugins.nameAria")} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Meu plugin" required />
            </label>
            <div className="api-form__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setCreating(false)}>
                {t("common.cancel")}
              </button>
              <button type="submit" className="btn btn--primary">
                {t("plugins.createButton")}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {addingSource && (
        <Dialog
          title={t("catalog.add")}
          description={t("catalog.addDescription")}
          onClose={() => setAddingSource(false)}
        >
          <form className="api-form" onSubmit={(e) => void addSource(e)}>
            <label>
              {t("catalog.addressLabel")}
              <input
                aria-label={t("catalog.addressAria")}
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
                placeholder="https://exemplo.com/marketplace.json"
                required
              />
            </label>
            <div className="api-form__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setAddingSource(false)}>
                {t("common.cancel")}
              </button>
              <button type="submit" className="btn btn--primary">
                {t("common.add")}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {deleting && (
        <ConfirmDialog
          title={t("plugins.deleteTitle", { name: deleting.name })}
          body={t("plugins.deleteBody")}
          confirmLabel={t("plugins.deleteConfirm")}
          danger
          onConfirm={() => void remove(deleting.id)}
          onCancel={() => setDeleting(undefined)}
        />
      )}

      {pendingLocal && (
        <ConfirmDialog
          title={t("plugins.installTitle", { name: pendingLocal.manifest.name })}
          body={
            <>
              <p>{t("plugins.permissionsIntro")}</p>
              <PermissionList permissions={pendingLocal.manifest.permissions} />
            </>
          }
          confirmLabel={t("common.install")}
          onCancel={() => setPendingLocal(undefined)}
          onConfirm={() => void installLocal()}
        />
      )}

      {pendingUpdate && (
        <ConfirmDialog
          title={t("plugins.updateTitle", { name: pendingUpdate.plugin.name })}
          body={
            <>
              <p>{t("plugins.updateIntro", { version: pendingUpdate.plugin.version })}</p>
              <PermissionList permissions={pendingUpdate.added} />
            </>
          }
          confirmLabel={t("plugins.update")}
          onCancel={() => setPendingUpdate(undefined)}
          onConfirm={() => void applyUpdate(pendingUpdate.plugin.id)}
        />
      )}

      {pending && (
        <ConfirmDialog
          title={t("plugins.installTitle", { name: pending.name })}
          body={
            <>
              <p>{t("plugins.permissionsIntro")}</p>
              <PermissionList permissions={pending.permissions} />
            </>
          }
          confirmLabel={t("common.install")}
          onCancel={() => setPending(undefined)}
          onConfirm={() => void install()}
        />
      )}
    </ExtensionPage>
  );
}
