import { useEffect, useState } from "react";
import { Download, Eye, Globe2, Search } from "lucide-react";
import {
  browserPasswords,
  importBrowserHtml,
  importBrowserPasswords,
  pickImportFile,
  playwrightInstall,
  playwrightStatus,
  type ImportTarget,
  type ImportedPassword,
} from "../../api";
import { getAgentBrowser, setAgentBrowser } from "../../chat/agentBrowser";
import { BrowserAgentCard } from "./BrowserAgentCard";
import { getSearchEngine, setSearchEngine } from "../../chat/searchEngine";
import type { AgentBrowser, SearchEngine } from "../../types";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { t } from "../../i18n";

const OPTIONS = [
  ["builtin", "settings.browser.builtin"],
  ["playwright", "settings.browser.playwright"],
] as const;

const ENGINES: Array<[SearchEngine, "settings.searchEngine.google" | "settings.searchEngine.duckduckgo" | "settings.searchEngine.bing" | "settings.searchEngine.brave"]> = [
  ["google", "settings.searchEngine.google"],
  ["duckduckgo", "settings.searchEngine.duckduckgo"],
  ["bing", "settings.searchEngine.bing"],
  ["brave", "settings.searchEngine.brave"],
] as const;

/// Navegador do agente. Só um vale por vez: o escolhido é o único que o agente recebe.
/// Instalar o Chromium do Playwright baixa arquivos grandes, então só roda depois de confirmar.
export function BrowserSection() {
  const [choice, setChoice] = useState<AgentBrowser>(getAgentBrowser);
  // true/false = Chromium do Playwright baixado ou não; undefined = ainda verificando.
  const [installed, setInstalled] = useState<boolean | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  // Motor da busca na barra do navegador embutido.
  const [engine, setEngine] = useState<SearchEngine>(getSearchEngine);
  // Aviso do que entrou na última importação.
  const [notice, setNotice] = useState<string | undefined>(undefined);
  // As senhas só saem do cofre quando a pessoa pede para ver.
  const [passwords, setPasswords] = useState<ImportedPassword[] | null>(null);
  const [copiedLogin, setCopiedLogin] = useState<string | undefined>(undefined);

  useEffect(() => {
    playwrightStatus().then(setInstalled, () => setInstalled(false));
  }, []);

  function change(next: AgentBrowser) {
    setChoice(next);
    setAgentBrowser(next);
  }

  async function install() {
    setConfirming(false);
    setBusy(true);
    setError(undefined);
    try {
      await playwrightInstall();
      setInstalled(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function changeEngine(next: SearchEngine) {
    setEngine(next);
    setSearchEngine(next);
  }

  /// Importa um HTML exportado: favoritos entram na lista, histórico nas visitas.
  async function importHtml(target: ImportTarget) {
    setError(undefined);
    setNotice(undefined);
    const path = await pickImportFile("html");
    if (!path) return;
    setBusy(true);
    try {
      const result = await importBrowserHtml(path, target);
      setNotice(
        target === "bookmarks"
          ? t("settings.browser.importResult.bookmarks", { count: result.bookmarks })
          : t("settings.browser.importResult.pages", { count: result.visits }),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  /// Importa o CSV de senhas: elas viram blobs criptografados no cofre do app.
  async function importPasswords() {
    setError(undefined);
    setNotice(undefined);
    const path = await pickImportFile("csv");
    if (!path) return;
    setBusy(true);
    try {
      const count = await importBrowserPasswords(path);
      // A lista guardada fica velha: quem já a abriu vai reler da próxima vez.
      setPasswords(null);
      setCopiedLogin(undefined);
      setNotice(t("settings.browser.importResult.passwords", { count }));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function showPasswords() {
    setError(undefined);
    try {
      setPasswords(await browserPasswords());
    } catch (e) {
      setError(String(e));
    }
  }

  async function copyPassword(entry: ImportedPassword) {
    setError(undefined);
    try {
      await navigator.clipboard.writeText(entry.password);
      setCopiedLogin(entry.login);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <section className="settings__section" aria-labelledby="settings-browser">
      <div className="settings__cards">
        <article className="settings__card">
          <header className="settings__card-head">
            <h2 id="settings-browser" className="settings__card-title">{t("settings.browser.title")}</h2>
            <p className="settings__hint">{t("settings.browser.help")}</p>
          </header>
          <div role="radiogroup" aria-labelledby="settings-browser" className="settings__chips">
            {OPTIONS.map(([id, key]) => (
              <label key={id} className="settings__chip">
                <input type="radio" name="agent-browser" value={id} checked={choice === id} onChange={() => change(id)} />
                <span>{t(key)}</span>
              </label>
            ))}
          </div>
          {choice === "playwright" && installed === false && (
            <div className="settings__install">
              <p className="settings__hint">{t("settings.browser.notInstalled")}</p>
              <button type="button" className="btn btn--sm" disabled={busy} onClick={() => setConfirming(true)}>
                {busy ? t("settings.browser.installing") : t("settings.browser.install")}
              </button>
            </div>
          )}
        </article>

        <BrowserAgentCard />

        <article className="settings__card">
          <header className="settings__card-head">
            <h3 id="settings-search-engine" className="settings__card-title">
              <Search size={14} aria-hidden="true" /> {t("settings.searchEngine.title")}
            </h3>
            <p className="settings__hint">{t("settings.searchEngine.help")}</p>
          </header>
          <div role="radiogroup" aria-labelledby="settings-search-engine" className="settings__chips">
            {ENGINES.map(([id, key]) => (
              <label key={id} className="settings__chip">
                <input type="radio" name="search-engine" value={id} checked={engine === id} onChange={() => changeEngine(id)} />
                <span>{t(key)}</span>
              </label>
            ))}
          </div>
        </article>

        <article className="settings__card">
          <header className="settings__card-head">
            <h3 id="settings-browser-import" className="settings__card-title">
              <Globe2 size={14} aria-hidden="true" /> {t("settings.browser.import.title")}
            </h3>
            <p className="settings__hint">{t("settings.browser.import.help")}</p>
          </header>
          <div className="settings__actions">
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void importHtml("bookmarks")}>
              <Download size={13} aria-hidden="true" /> {t("settings.browser.importFavorites")}
            </button>
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void importHtml("history")}>
              <Download size={13} aria-hidden="true" /> {t("settings.browser.importHistory")}
            </button>
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void importPasswords()}>
              <Download size={13} aria-hidden="true" /> {t("settings.browser.importPasswords")}
            </button>
          </div>
          {notice && (
            <p className="settings__hint" role="status">
              {notice}
            </p>
          )}

          <div className="settings__actions">
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void showPasswords()}>
              <Eye size={13} aria-hidden="true" /> {t("settings.browser.passwordsShow")}
            </button>
          </div>
          {passwords && (
            <div className="settings__vault">
              <h4 className="settings__vault-title">{t("settings.browser.passwordsTitle")}</h4>
              {passwords.length ? (
                <ul className="settings__passwords">
                  {passwords.map((entry) => (
                    <li key={`${entry.url}:${entry.login}`}>
                      <button
                        type="button"
                        className="btn btn--sm"
                        aria-label={t("settings.browser.passwordCopy", { login: entry.login })}
                        onClick={() => void copyPassword(entry)}
                      >
                        {t("settings.browser.passwordCopy", { login: entry.login })}
                      </button>
                      <span title={entry.url}>{entry.url}</span>
                      {copiedLogin === entry.login && (
                        <span role="status">{t("settings.browser.passwordCopied")}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="settings__hint">{t("settings.browser.passwordsEmpty")}</p>
              )}
            </div>
          )}
        </article>
      </div>

      {error && (
        <p className="settings__hint" role="alert">
          {error}
        </p>
      )}

      {confirming && (
        <ConfirmDialog
          title={t("settings.browser.installTitle")}
          body={t("settings.browser.installBody")}
          confirmLabel={t("settings.browser.installConfirm")}
          onConfirm={() => void install()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </section>
  );
}
