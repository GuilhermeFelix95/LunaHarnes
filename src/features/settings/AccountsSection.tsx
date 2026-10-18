import { useEffect, useState } from "react";
import { checkAuth } from "../../api";
import type { ProviderKind } from "../../types";
import { PROVIDER_LABELS } from "../../chat/providers";

function loginLabel(state: boolean | null | undefined): string {
  if (state === undefined) return "verificando…";
  if (state === null) return "não foi possível verificar";
  return state ? "conectado" : "não conectado";
}

/// Contas: o login de cada CLI. Quem entra aqui é o próprio Claude Code e o Codex, não as chaves de API.
export function AccountsSection() {
  // true/false = conectado ou não; null = a checagem falhou; ausente = ainda verificando.
  const [login, setLogin] = useState<Partial<Record<ProviderKind, boolean | null>>>({});

  useEffect(() => {
    void Promise.all([checkAuth("claude"), checkAuth("codex")])
      .then(([claude, codex]) => setLogin({ claude, codex }))
      .catch(() => setLogin({ claude: null, codex: null }));
  }, []);

  return (
    <section className="settings__section" aria-labelledby="settings-accounts">
      <h2 id="settings-accounts">Contas</h2>
      <p className="settings__hint">
        Cada CLI usa a própria conta. Para entrar ou trocar de conta, abra o login pela conversa; as chaves de API ficam
        em Provedores.
      </p>
      <ul className="settings-list">
        {(["claude", "codex"] as ProviderKind[]).map((p) => (
          <li key={p} className="settings-card">
            <div>
              <strong>{PROVIDER_LABELS[p]}</strong>
              <span className="settings-card__meta">{loginLabel(login[p])}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
