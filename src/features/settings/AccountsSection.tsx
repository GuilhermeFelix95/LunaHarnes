import { useCallback, useEffect, useState } from "react";
import { checkAuth, cliStatus, installCli, openLogin } from "../../api";
import type { CliStatus, ProviderKind } from "../../types";
import { PROVIDER_LABELS } from "../../chat/providers";
import { t } from "../../i18n";

function loginLabel(state: boolean | null | undefined): string {
  if (state === undefined) return t("accounts.checking");
  if (state === null) return t("accounts.checkFailed");
  return state ? t("accounts.connected") : t("accounts.notConnected");
}

/// Contas: o login de cada CLI. Quem entra aqui é o próprio Claude Code e o Codex, não as chaves de API.
/// "Baixar e conectar" instala a CLI se ela faltar (o instalador oficial, como na primeira abertura) e abre o login dela.
export function AccountsSection() {
  // true/false = conectado ou não; null = a checagem falhou; ausente = ainda verificando.
  const [login, setLogin] = useState<Partial<Record<ProviderKind, boolean | null>>>({});
  const [cli, setCli] = useState<Partial<Record<ProviderKind, CliStatus>>>({});
  const [busy, setBusy] = useState<ProviderKind | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ProviderKind, string>>>({});

  const refresh = useCallback(() => {
    void Promise.all([checkAuth("claude"), checkAuth("codex"), checkAuth("opencode"), checkAuth("cline"), checkAuth("copilot"), checkAuth("antigravity")])
      .then(([claude, codex, opencode, cline, copilot, antigravity]) => setLogin({ claude, codex, opencode, cline, copilot, antigravity }))
      .catch(() => setLogin({ claude: null, codex: null, opencode: null, cline: null, copilot: null, antigravity: null }));
  }, []);

  useEffect(() => {
    refresh();
    void cliStatus()
      .then((list) => setCli(Object.fromEntries(list.map((s) => [s.provider, s]))))
      .catch(() => {});
    // O login acontece no navegador: ao voltar para o app, confere de novo.
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

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
          return (
            <li key={p} className="settings-card">
              <div>
                <strong>{PROVIDER_LABELS[p]}</strong>
                <span className="settings-card__meta">{loginLabel(login[p])}</span>
                {installed && cli[p]?.path && <span className="settings-card__meta">{t("accounts.cliAt", { path: cli[p]?.path ?? "" })}</span>}
                {installed === false && !canDownload && <span className="settings-card__meta">{t(p === "cline" ? "accounts.clineInstall" : p === "copilot" ? "accounts.copilotInstall" : p === "antigravity" ? "accounts.antigravityInstall" : "accounts.opencodeInstall")}</span>}
                {errors[p] && (
                  <span className="settings-card__meta" role="alert">
                    {errors[p]}
                  </span>
                )}
              </div>
              {action && (
                <button type="button" className="btn btn--sm" disabled={busy !== null} onClick={() => void connect(p)}>
                  {busy === p ? t("accounts.wait") : action}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
