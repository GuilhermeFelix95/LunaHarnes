import { useCallback, useEffect, useState } from "react";
import { checkAuth, cliStatus, installCli, openLogin } from "../../api";
import type { CliStatus, ProviderKind } from "../../types";
import { PROVIDER_LABELS } from "../../chat/providers";

function loginLabel(state: boolean | null | undefined): string {
  if (state === undefined) return "verificando…";
  if (state === null) return "não foi possível verificar";
  return state ? "conectado" : "não conectado";
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
    void Promise.all([checkAuth("claude"), checkAuth("codex")])
      .then(([claude, codex]) => setLogin({ claude, codex }))
      .catch(() => setLogin({ claude: null, codex: null }));
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
      <h2 id="settings-accounts">Contas</h2>
      <p className="settings__hint">
        Cada CLI usa a própria conta. "Baixar e conectar" instala a CLI se ela faltar e abre o login dela. As chaves de API
        ficam em Provedores.
      </p>
      <ul className="settings-list">
        {(["claude", "codex"] as ProviderKind[]).map((p) => {
          const installed = cli[p]?.installed;
          const connected = login[p] === true;
          // Logada: nada a fazer. Instalada mas sem login: só o login. Sem CLI: baixar e conectar.
          const action = connected || installed === undefined ? null : installed ? "Conectar" : "Baixar e conectar";
          return (
            <li key={p} className="settings-card">
              <div>
                <strong>{PROVIDER_LABELS[p]}</strong>
                <span className="settings-card__meta">{loginLabel(login[p])}</span>
                {installed && cli[p]?.path && <span className="settings-card__meta">CLI em {cli[p]?.path}</span>}
                {errors[p] && (
                  <span className="settings-card__meta" role="alert">
                    {errors[p]}
                  </span>
                )}
              </div>
              {action && (
                <button type="button" className="btn btn--sm" disabled={busy !== null} onClick={() => void connect(p)}>
                  {busy === p ? "Aguarde…" : action}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
