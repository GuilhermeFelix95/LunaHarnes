import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Ícone lucide da tela. Opcional: sem ele, só o texto aparece. */
  icon?: ReactNode;
  children: ReactNode;
}

/// Estado vazio no padrão do app: ícone, uma linha de texto. Mesmo visual em todas as telas.
export function EmptyState({ icon, children }: EmptyStateProps) {
  return (
    <div className="empty">
      {icon && (
        <span className="empty__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="empty__text">{children}</p>
    </div>
  );
}
