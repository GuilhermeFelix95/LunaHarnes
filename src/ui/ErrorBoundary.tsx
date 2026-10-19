import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "../i18n";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/// Se a tela quebra, mostra um aviso com recarregar em vez de deixar a janela em branco.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`erro ao desenhar a tela: ${error.message}`, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="error-boundary">
        <h1>{t("error.boundary.title")}</h1>
        <p>{t("error.boundary.body")}</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          {t("error.boundary.reload")}
        </button>
      </div>
    );
  }
}
