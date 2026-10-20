import { useCallback, useEffect, useRef, useState } from "react";
import { ACCOUNTS_CHANGED, checkAuth, cliStatus, createAccount, installCli, listAccounts, openLogin } from "../../api";
import type { Account, CliStatus, ProviderKind } from "../../types";
import { PROVIDER_LABELS } from "../../chat/providers";
import { t } from "../../i18n";

const ALL_PROVIDERS: ProviderKind[] = ["claude", "codex", "opencode", "cline", "copilot", "antigravity"];
/// O que já foi visto: CLI instalada e login conectado, lembrados no computador.
const CACHE_KEY = "luna.accounts";
/// Marca que a checagem completa já rodou nesta abertura do app.
const CHECKED_KEY = "luna.accountsChecked";

interface AccountsCache {
  cli: Partial<Record<ProviderKind, CliStatus>>;
  login: Partial<Record<ProviderKind, boolean>>;
}

function readCache(): AccountsCache {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as AccountsCache;
  } catch {
    // Cache ilegível ou sem armazenamento: a tela faz a checagem normal.
  }
  return { cli: {}, login: {} };
}

function writeCache(value: AccountsCache) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // Sem armazenamento a tela segue igual; só não lembra na próxima vez.
  }
}

function alreadyChecked(): boolean {
  try {
    return window.sessionStorage.getItem(CHECKED_KEY) === "1";
  } catch {
    return false;
  }
}

function markChecked() {
  try {
    window.sessionStorage.setItem(CHECKED_KEY, "1");
  } catch {
    // Sem armazenamento, a próxima entrada confere de novo. Não é erro.
  }
}

function loginLabel(state: boolean | null | undefined): string {
  if (state === undefined) return t("accounts.checking");
  if (state === null) return t("accounts.checkFailed");
  return state ? t("accounts.connected") : t("accounts.notConnected");
}

/// Contas: o login de cada CLI. Quem entra aqui é o próprio Claude Code e o Codex, não as chaves de API.
/// "Baixar e conectar" instala a CLI se ela faltar (o instalador oficial, como na primeira abertura) e abre o login dela.
/// Entrar de novo nas Contas não confere tudo de novo: mostra o que já foi visto e checa só o que falta.
export function AccountsSection() {
  // Começa pelo que já foi visto antes; a checagem atualiza depois, se for preciso.
  const [cache] = useState(readCache);
  // true/false = conectado ou não; null = a checagem falhou; ausente = ainda verificando.
  const [login, setLogin] = useState<Partial<Record<ProviderKind, boolean | null>>>(cache.login);
  const [cli, setCli] = useState<Partial<Record<ProviderKind, CliStatus>>>(cache.cli);
  const [busy, setBusy] = useState<ProviderKind | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ProviderKind, string>>>({});
  const loginRef = useRef(login);
  loginRef.current = login;
  // Contas extras (Claude e Codex). `adding` é a CLI cujo formulário de nova conta está aberto.
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [adding, setAdding] = useState<ProviderKind | null>(null);
  const [newName, setNewName] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .catch((e) => setAccountError(String(e)));
  }, []);

  const refresh = useCallback((providers: ProviderKind[]) => {
    void Promise.all(providers.map((p) => checkAuth(p).then((ok) => [p, ok] as const).catch(() => [p, null] as const))).then((results) =>
      setLogin((current) => ({ ...current, ...(Object.fromEntries(results) as Partial<Record<ProviderKind, boolean | null>>) })),
    );
  }, []);

  useEffect(() => {
    // Primeira entrada da abertura: confere tudo. Depois, só detecta de novo as CLIs que ainda não achou.
    const firstLook = !alreadyChecked();
    const missingCli = (["claude", "codex"] as ProviderKind[]).some((p) => !cache.cli[p]?.installed);
    if (firstLook) {
      markChecked();
      refresh(ALL_PROVIDERS);
    }
    if (firstLook || missingCli) {
      void cliStatus()
        .then((list) => setCli((current) => ({ ...current, ...Object.fromEntries(list.map((s) => [s.provider, s])) })))
        .catch(() => {});
    }
    // O login acontece no navegador: ao voltar para o app, confere só quem ainda não entrou.
    const onFocus = () => refresh(ALL_PROVIDERS.filter((p) => loginRef.current[p] !== true));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [cache, refresh]);

  // Guarda o que foi visto, para a próxima entrada mostrar sem esperar.
  useEffect(() => {
    const loggedIn: Partial<Record<ProviderKind, boolean>> = {};
    for (const p of ALL_PROVIDERS) {
      const state = login[p];
      if (state === true || state === false) loggedIn[p] = state;
    }
    writeCache({ cli, login: loggedIn });
  }, [cli, login]);

  async function connect(p: ProviderKind) {
    setBusy(p);
    setErrors((current) => ({ ...current, [p]: undefined }));
    try {
      // installCli só instala se a CLI ainda não estiver no computador.
      if (!cli[p]?.installed) {
        const status = await installCli(p);
        setCli((current) => ({ ...current, [p]: status }));
      }
      await openLogin(p);
    } catch (e) {
      setErrors((current) => ({ ...current, [p]: String(e) }));
    } finally {
      setBusy(null);
    }
  }

  async function submitAccount(p: ProviderKind) {
    const name = newName.trim();
    if (!name) return;
    setAccountError(null);
    try {
      const created = await createAccount(p, name);
      setAccounts((list) => [...list, created]);
      setAdding(null);
      setNewName("");
      window.dispatchEvent(new Event(ACCOUNTS_CHANGED));
    } catch (e) {
      setAccountError(String(e));
    }
  }

  return (
    <section className="settings__section" aria-labelledby="settings-accounts">
      <h2 id="settings-accounts">{t("settings.nav.accounts")}</h2>
      <p className="settings__hint">{t("accounts.help")}</p>
      <ul className="settings-list">
        {(["claude", "codex", "opencode", "cline", "copilot", "antigravity"] as ProviderKind[]).map((p) => {
          const installed = cli[p]?.installed;
          const connected = login[p] === true;
          // Logada: nada a fazer. Instalada mas sem login: só o login. Sem CLI: baixar e conectar.
          // O OpenCode, o Cline, o Copilot e o Antigravity não têm instalador pelo app: sem CLI, a pessoa instala pelo site ou pelo gerenciador.
          const canDownload = p !== "opencode" && p !== "cline" && p !== "copilot" && p !== "antigravity";
          const action = connected || installed === undefined ? null : installed ? t("accounts.connect") : canDownload ? t("accounts.downloadConnect") : null;
          // Estado da conexão: o ponto de cor mostra de relance o que o texto diz.
          const state = login[p] === true ? "connected" : login[p] === undefined ? "checking" : login[p] === null ? "failed" : "off";
          return (
            <li key={p} className={`settings-card account-card account-card--${state}`}>
              <div className="account-card__head">
                <span className="account-card__dot" aria-hidden="true" />
                <strong>{PROVIDER_LABELS[p]}</strong>
                <span className="account-card__status">{loginLabel(login[p])}</span>
                {action && (
                  <button type="button" className="btn btn--sm account-card__action" disabled={busy !== null} onClick={() => void connect(p)}>
                    {busy === p ? t("accounts.wait") : action}
                  </button>
                )}
              </div>
              {installed && cli[p]?.path && <p className="account-card__path">{t("accounts.cliAt", { path: cli[p]?.path ?? "" })}</p>}
              {installed === false && !canDownload && (
                <p className="account-card__hint">{t(p === "cline" ? "accounts.clineInstall" : p === "copilot" ? "accounts.copilotInstall" : p === "antigravity" ? "accounts.antigravityInstall" : "accounts.opencodeInstall")}</p>
              )}
              {errors[p] && (
                <p className="notice" role="alert">
                  {errors[p]}
                </p>
              )}
              {(p === "claude" || p === "codex") && (
                <div className="account-extra">
                  <strong className="account-extra__title">{t("accounts.extraTitle")}</strong>
                  {accounts
                    .filter((a) => a.provider === p)
                    .map((a) => (
                      <p key={a.id} className="account-card__path">
                        {a.name}
                      </p>
                    ))}
                  {adding === p ? (
                    <form
                      className="account-extra__form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void submitAccount(p);
                      }}
                    >
                      <input
                        autoFocus
                        aria-label={t("accounts.accountNamePlaceholder")}
                        placeholder={t("accounts.accountNamePlaceholder")}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                      <button type="submit" className="btn btn--sm" disabled={!newName.trim()}>
                        {t("accounts.create")}
                      </button>
                      <button type="button" className="btn btn--sm" onClick={() => setAdding(null)}>
                        {t("accounts.cancel")}
                      </button>
                    </form>
                  ) : (
                    <button type="button" className="btn btn--sm" onClick={() => setAdding(p)}>
                      {t("accounts.addAccount")}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {accountError && (
        <p className="notice" role="alert">
          {accountError}
        </p>
      )}
    </section>
  );
}
