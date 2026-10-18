import type { ReactNode } from "react";

interface ExtensionPageProps {
  /** Título da seção (h2), igual ao nome na navegação. */
  title: string;
  /** Uma frase sobre o que a extensão faz e onde ela vale. */
  description: string;
  /** Ações principais, no canto do cabeçalho (ex.: "Criar", "Adicionar"). */
  actions?: ReactNode;
  /** Abas "Instaladas" e "Marketplace" (ou outras). A aba ativa é controlada pela seção. */
  tabs: Array<{ id: string; label: string }>;
  tab: string;
  onTab: (id: string) => void;
  status?: string;
  error?: string;
  children: ReactNode;
}

/// Layout comum das telas de extensões (Plugins, Skills, MCP): cabeçalho, abas, avisos e conteúdo.
/// Cada tela só diz o que mostra; o visual e a ordem ficam iguais.
export function ExtensionPage({ title, description, actions, tabs, tab, onTab, status, error, children }: ExtensionPageProps) {
  const id = title.toLowerCase().replace(/\s+/g, "-");
  return (
    <section className="settings__section" aria-labelledby={`settings-${id}`}>
      <header className="settings__section-head">
        <div>
          <h2 id={`settings-${id}`}>{title}</h2>
          <p className="settings__hint">{description}</p>
        </div>
        {actions && <div className="settings-actions">{actions}</div>}
      </header>

      <div className="segmented" role="tablist" aria-label={title}>
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {status && (
        <p role="status" className="settings__hint">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="message__error">
          {error}
        </p>
      )}

      {children}
    </section>
  );
}
