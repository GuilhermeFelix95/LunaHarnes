import { useEffect, useState, type FormEvent } from "react";
import {
  addCatalogSource,
  installCatalogPlugin,
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

/// Explica cada permissão em português, para o diálogo de instalação.
const PERMISSION_TEXT: Record<string, string> = {
  commands: "registra comandos com barra, como /nome",
  hooks: "lê e pode alterar o texto antes de enviar, e lê cada resposta",
  modes: "oferece um modo de somente leitura no composer",
};

function announceChange() {
  window.dispatchEvent(new Event(PLUGINS_CHANGED));
}

/// Seção "Plugins": instalados (ligar, desligar, excluir) e marketplace (catálogos oficial e por URL).
export function PluginsSection() {
  const [tab, setTab] = useState<Tab>("installed");
  const [installed, setInstalled] = useState<PluginManifest[]>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [scanErrors, setScanErrors] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<string | undefined>(undefined);

  const [sources, setSources] = useState<string[]>([]);
  const [source, setSource] = useState(OFFICIAL_SOURCE);
  const [sourceInput, setSourceInput] = useState("");
  const [catalog, setCatalog] = useState<Catalog | undefined>(undefined);
  const [pending, setPending] = useState<CatalogPlugin | undefined>(undefined);

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
      setStatus(enable ? "Plugin ligado." : "Plugin desligado.");
      announceChange();
    } catch (e) {
      setError(String(e));
    }
  }

  async function remove(id: string) {
    setError(undefined);
    try {
      await uninstallPlugin(id);
      setConfirming(undefined);
      setStatus("Plugin excluído.");
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
      setStatus(`${pending.name} instalado. Ele vale no próximo envio.`);
      setPending(undefined);
      announceChange();
      await reloadInstalled();
    } catch (e) {
      setError(String(e));
    }
  }

  /// Troca o plugin instalado pela versão do catálogo. Sem diálogo: a permissão não muda entre versões.
  async function update(id: string) {
    setError(undefined);
    try {
      await installCatalogPlugin(source, id);
      setStatus("Plugin atualizado. Ele vale no próximo envio.");
      announceChange();
      await reloadInstalled();
    } catch (e) {
      setError(String(e));
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
      setSources(await listCatalogSources());
      setSource(url);
      setCatalog(added);
      setStatus(`Catálogo "${added.name}" adicionado.`);
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
      setStatus("Catálogo removido.");
    } catch (err) {
      setError(String(err));
    }
  }

  const installedIds = new Set(installed.map((p) => p.id));
  const installedVersions = new Map(installed.map((p) => [p.id, p.version]));

  return (
    <section className="settings__section" aria-labelledby="settings-plugins">
      <h2 id="settings-plugins">Plugins</h2>
      <p className="settings__hint">
        Plugins rodam com as permissões que você aceita na instalação. Instale só de fontes em que você confia.
      </p>

      <div className="tabs" role="tablist" aria-label="Plugins">
        <button type="button" role="tab" aria-selected={tab === "installed"} onClick={() => setTab("installed")}>
          Instalados
        </button>
        <button type="button" role="tab" aria-selected={tab === "market"} onClick={() => setTab("market")}>
          Marketplace
        </button>
      </div>

      {status && <p role="status" className="settings__hint">{status}</p>}
      {error && <p role="alert" className="message__error">{error}</p>}

      {tab === "installed" && (
        <>
          {installed.length === 0 && <p className="settings__hint">Nenhum plugin instalado.</p>}
          <ul className="profiles">
            {installed.map((p) => {
              const off = disabled.includes(p.id);
              return (
                <li key={p.id} className="profile">
                  <div className="profile__head">
                    <strong>{p.name}</strong>
                    <span className="profile__meta">
                      v{p.version} · permissões: {p.permissions.join(", ") || "nenhuma"} · {off ? "desligado" : "ligado"}
                    </span>
                  </div>
                  <div className="profile__actions">
                    <button type="button" onClick={() => void toggle(p.id, off)}>
                      {off ? "Ligar" : "Desligar"}
                    </button>
                    {confirming === p.id ? (
                      <button type="button" className="profile__danger" onClick={() => void remove(p.id)}>
                        Confirmar exclusão
                      </button>
                    ) : (
                      <button type="button" onClick={() => setConfirming(p.id)}>
                        Excluir
                      </button>
                    )}
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
        </>
      )}

      {tab === "market" && (
        <>
          <div className="api-form__actions">
            <label>
              Catálogo
              <select aria-label="Catálogo" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value={OFFICIAL_SOURCE}>LunaHarness oficial</option>
                {sources.map((url) => (
                  <option key={url} value={url}>
                    {url}
                  </option>
                ))}
              </select>
            </label>
            {source !== OFFICIAL_SOURCE && (
              <button type="button" onClick={() => void dropSource()}>
                Remover catálogo
              </button>
            )}
          </div>

          {!catalog && <p className="settings__hint">Carregando catálogo…</p>}
          {catalog && catalog.plugins.length === 0 && <p className="settings__hint">Este catálogo está vazio.</p>}
          <ul className="profiles">
            {catalog?.plugins.map((p) => (
              <li key={p.id} className="profile">
                <div className="profile__head">
                  <strong>{p.name}</strong>
                  <span className="profile__meta">
                    v{p.version} · {p.author}
                  </span>
                </div>
                <p className="settings__hint">{p.description}</p>
                <div className="profile__actions">
                  {isNewerVersion(p.version, installedVersions.get(p.id)) ? (
                    <button type="button" onClick={() => void update(p.id)}>
                      Atualizar
                    </button>
                  ) : (
                    <button type="button" disabled={installedIds.has(p.id)} onClick={() => setPending(p)}>
                      {installedIds.has(p.id) ? "Instalado" : "Instalar"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <form className="api-form" onSubmit={(e) => void addSource(e)}>
            <h3 className="settings__sub">Adicionar catálogo por URL</h3>
            <label>
              Endereço do catálogo (https)
              <input
                aria-label="Endereço do catálogo"
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
                placeholder="https://exemplo.com/marketplace.json"
                required
              />
            </label>
            <div className="api-form__actions">
              <button type="submit">Adicionar catálogo</button>
            </div>
          </form>
        </>
      )}

      {pending && (
        <div className="dialog-backdrop">
          <div role="dialog" aria-modal="true" aria-labelledby="install-title" className="dialog">
            <h3 id="install-title">Instalar {pending.name}?</h3>
            <p className="settings__hint">Este plugin vai pedir estas permissões:</p>
            <ul>
              {pending.permissions.map((perm) => (
                <li key={perm}>{PERMISSION_TEXT[perm] ?? `permissão "${perm}"`}</li>
              ))}
            </ul>
            <div className="api-form__actions">
              <button type="button" onClick={() => setPending(undefined)}>
                Cancelar
              </button>
              <button type="button" onClick={() => void install()}>
                Instalar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
