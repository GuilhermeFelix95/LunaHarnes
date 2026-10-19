import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource/outfit";
import "@fontsource/space-grotesk";
import "@fontsource/fraunces";
import "@fontsource/lora";
import "@fontsource/jetbrains-mono";
import "@fontsource/press-start-2p";
import "@fontsource/vt323";
import "@fontsource/silkscreen";
import { App } from "./App";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import "./styles/tokens.css";
import "./styles/themes.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/theme-layers.css";
import { applyLiquidGlass, applyTheme, loadLiquidGlass, loadTheme } from "./theme";

// Antes do primeiro render, para a tela não piscar no tema errado.
applyTheme(loadTheme());
applyLiquidGlass(loadLiquidGlass());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
