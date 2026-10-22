import { useEffect, useState, type FormEvent } from "react";
import {
  claudeCliVersionOk,
  claudeMarketplaceAdd,
  claudeMarketplaceRemove,
  claudeMarketplacesList,
  claudePluginDetails,
  claudePluginInstall,
  claudePluginSetEnabled,
  claudePluginUninstall,
  claudePluginUpdate,
  claudePluginsCatalog,
  type ClaudeAvailablePlugin,
  type ClaudeCatalog,
  type ClaudeMarketplace,
} from "../../api";
import { t } from "../../i18n";

/// Quantos disponíveis aparecem de uma vez: o catálogo do marketplace oficial tem milhares de entradas.
const SHOWN = 50;
const GITHUB_SOURCE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const HTTPS_SOURCE = /^https:\/\/[^\s;&|`$"']+$/;

/// Plugins do Claude Code geridos pela CLI: instalados, disponíveis para revisar e instalar, e marketplaces.
export function ClaudePluginsSection() {
  const [cliOk, setCliOk] = useState<boolean | null>(null);
  const [catalog, setCatalog] = useState<ClaudeCatalog | null>(null);
  const [marketplaces, setMarketplaces] = useState<ClaudeMarketplace[]>([]);
  const [query, setQuery] = useState("");
  const [reviewing, setReviewing] = useState<ClaudeAvailablePlugin | null>(null);
  const [details, setDetails] = useState("");
  const [removingPlugin, setRemovingPlugin] = useState<string | null>(null);
  const [removingMarketplace, setRemovingMarketplace] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [nextCatalog, nextMarketplaces] = await Promise.all([claudePluginsCatalog(), claudeMarketplacesList()]);
    setCatalog(nextCatalog);
    setMarketplaces(nextMarketplaces);
  }

  useEffect(() => {
    claudeCliVersionOk().then(setCliOk, () => setCliOk(false));
    load().catch((err: unknown) => setError(String(err)));
  }, []);

  /// Roda uma ação na CLI, mostra a falha se houver e recarrega a lista depois.
  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(String(err));
    }
  }

  async function review(plugin: ClaudeAvailablePlugin) {
    setReviewing(plugin);
    setDetails("");
    setError(null);
    try {
      setDetails(await claudePluginDetails(plugin.pluginId));
    } catch (err) {
      setError(String(err));
    }
  }

  function addMarketplace(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = source.trim();
    if (!GITHUB_SOURCE.test(value) && !HTTPS_SOURCE.test(value)) {
      setError(t("claudePlugins.invalidSource"));
      return;
    }
    void act(async () => {
      await claudeMarketplaceAdd(value);
      setSource("");
    });
  }

  const needle = query.trim().toLowerCase();
  const matches = (catalog?.available ?? []).filter(
    (p) => !needle || p.name.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle),
  );
  const shown = matches.slice(0, SHOWN);

  return (
    <section className="settings__section claude-plugins" aria-labelledby="settings-claude-plugins">
      <h2 id="settings-claude-plugins">{t("claudePlugins.title")}</h2>
      <p className="claude-plugins__intro">{t("claudePlugins.intro")}</p>
      {cliOk === false && <p className="claude-plugins__warning" role="status">{t("claudePlugins.oldCli")}</p>}
      {error && <p className="claude-plugins__error" role="alert">{error}</p>}
      {!catalog && !error && <p>{t("claudePlugins.loading")}</p>}

      {catalog && (
        <>
          <h3>{t("claudePlugins.installed")}</h3>
          {catalog.installed.length === 0 ? (
            <p>{t("claudePlugins.noneInstalled")}</p>
          ) : (
            <ul className="claude-plugins__list">
              {catalog.installed.map((plugin) => (
                <li key={plugin.id} className="claude-plugins__item">
                  <div className="claude-plugins__info">
                    <span className="claude-plugins__name">{plugin.id}</span>
                    <span className="claude-plugins__meta">
                      {plugin.scope === "user" ? t("claudePlugins.scopeUser") : plugin.scope} · v{plugin.version}
                    </span>
                  </div>
                  <div className="claude-plugins__actions">
                    <button type="button" className="btn btn--sm" onClick={() => void act(() => claudePluginSetEnabled(plugin.id, !plugin.enabled))}>
                      {plugin.enabled ? t("claudePlugins.disable") : t("claudePlugins.enable")}
                    </button>
                    <button type="button" className="btn btn--sm" onClick={() => void act(() => claudePluginUpdate(plugin.id))}>
                      {t("claudePlugins.update")}
                    </button>
                    {removingPlugin === plugin.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => {
                            setRemovingPlugin(null);
                            void act(() => claudePluginUninstall(plugin.id, true));
                          }}
                        >
                          {t("claudePlugins.confirmRemove")}
                        </button>
                        <button type="button" className="btn btn--sm" onClick={() => setRemovingPlugin(null)}>
                          {t("claudePlugins.cancel")}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--sm"
                        aria-label={t("claudePlugins.removeAria", { id: plugin.id })}
                        onClick={() => setRemovingPlugin(plugin.id)}
                      >
                        {t("claudePlugins.remove")}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {reviewing && (
            <section className="claude-plugins__review" aria-label={t("claudePlugins.reviewing")}>
              <h3>{t("claudePlugins.reviewing")}</h3>
              <p className="claude-plugins__name">{reviewing.pluginId}</p>
              <pre className="claude-plugins__details">{details}</pre>
              <div className="claude-plugins__actions">
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() =>
                    void act(async () => {
                      await claudePluginInstall(reviewing.pluginId, true);
                      setReviewing(null);
                    })
                  }
                >
                  {t("claudePlugins.confirmInstall")}
                </button>
                <button type="button" className="btn btn--sm" onClick={() => setReviewing(null)}>
                  {t("claudePlugins.cancel")}
                </button>
              </div>
            </section>
          )}

          <h3>{t("claudePlugins.available")}</h3>
          <input
            type="search"
            className="claude-plugins__search"
            aria-label={t("claudePlugins.search")}
            value={query}
            placeholder={t("claudePlugins.search")}
            onChange={(e) => setQuery(e.target.value)}
          />
          {matches.length > SHOWN && (
            <p className="claude-plugins__meta">{t("claudePlugins.limit", { count: shown.length, total: matches.length })}</p>
          )}
          <ul className="claude-plugins__list">
            {shown.map((plugin) => (
              <li key={plugin.pluginId} className="claude-plugins__item">
                <div className="claude-plugins__info">
                  <span className="claude-plugins__name">{plugin.name}</span>
                  <span className="claude-plugins__meta">{plugin.description}</span>
                </div>
                <div className="claude-plugins__actions">
                  <button
                    type="button"
                    className="btn btn--sm"
                    aria-label={t("claudePlugins.reviewAria", { name: plugin.name })}
                    onClick={() => void review(plugin)}
                  >
                    {t("claudePlugins.review")}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <h3>{t("claudePlugins.marketplaces")}</h3>
          <ul className="claude-plugins__list">
            {marketplaces.map((marketplace) => (
              <li key={marketplace.name} className="claude-plugins__item">
                <div className="claude-plugins__info">
                  <span className="claude-plugins__name">{marketplace.name}</span>
                  <span className="claude-plugins__meta">{marketplace.origin}</span>
                </div>
                <div className="claude-plugins__actions">
                  {removingMarketplace === marketplace.name ? (
                    <>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => {
                          setRemovingMarketplace(null);
                          void act(() => claudeMarketplaceRemove(marketplace.name, true));
                        }}
                      >
                        {t("claudePlugins.confirmRemove")}
                      </button>
                      <button type="button" className="btn btn--sm" onClick={() => setRemovingMarketplace(null)}>
                        {t("claudePlugins.cancel")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--sm"
                      aria-label={t("claudePlugins.removeMarketplaceAria", { name: marketplace.name })}
                      onClick={() => setRemovingMarketplace(marketplace.name)}
                    >
                      {t("claudePlugins.remove")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <form className="claude-plugins__add" onSubmit={addMarketplace}>
            <label>
              <span>{t("claudePlugins.marketplaceSource")}</span>
              <input
                type="text"
                value={source}
                placeholder={t("claudePlugins.marketplaceHint")}
                onChange={(e) => setSource(e.target.value)}
              />
            </label>
            <button type="submit" className="btn btn--sm">
              {t("claudePlugins.addMarketplace")}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
