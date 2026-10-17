// Espelha src-tauri/src/providers/mod.rs. Mantenha os dois lados em sincronia.

export type ProviderKind = "claude" | "codex";

export type ProviderEvent =
  | { kind: "sessionStarted"; sessionId: string }
  | { kind: "textDelta"; text: string }
  | { kind: "error"; message: string }
  | { kind: "done"; ok: boolean };

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  error?: string;
}
