import type { ProviderKind } from "../../types";
import { t } from "../../i18n";

const LABELS: Record<ProviderKind, string> = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  cline: "Cline",
  copilot: "GitHub Copilot",
  antigravity: "Antigravity",
  hermes: "Hermes",
};

interface LoginPromptProps {
  provider: ProviderKind;
  onLogin: () => void;
  onCheck: () => void;
  checking: boolean;
  /** Erro da última tentativa de login ou verificação. Fica só aqui, não no chat. */
  error?: string;
}

/// Aviso mostrado enquanto a conta do provedor não está conectada.
export function LoginPrompt({ provider, onLogin, onCheck, checking, error }: LoginPromptProps) {
  return (
    <section className="login-prompt" role="status">
      <p>{t("login.body", { provider: LABELS[provider] })}</p>
      <div className="login-prompt__actions">
        <button type="button" className="btn btn--primary" onClick={onLogin}>
          {t("login.signIn")}
        </button>
        <button type="button" className="btn" onClick={onCheck} disabled={checking}>
          {checking ? t("login.checking") : t("login.checked")}
        </button>
      </div>
      {error && <p role="alert" className="login-prompt__error">{error}</p>}
    </section>
  );
}
