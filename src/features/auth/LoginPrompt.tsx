import type { ProviderKind } from "../../types";

const LABELS: Record<ProviderKind, string> = {
  claude: "Claude Code",
  codex: "Codex",
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
      <p>
        Entre na sua conta do {LABELS[provider]} para começar. O login abre numa janela
        própria, no navegador.
      </p>
      <div className="login-prompt__actions">
        <button type="button" onClick={onLogin}>
          Entrar na conta
        </button>
        <button type="button" onClick={onCheck} disabled={checking}>
          {checking ? "Verificando..." : "Já entrei, verificar"}
        </button>
      </div>
      {error && <p role="alert" className="login-prompt__error">{error}</p>}
    </section>
  );
}
