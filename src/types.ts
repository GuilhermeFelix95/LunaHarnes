// Espelha src-tauri/src/providers/mod.rs. Mantenha os dois lados em sincronia.

export type ProviderKind = "claude" | "codex";

/// Permissão escolhida no composer. Cada CLI recebe o modo equivalente (ver providers/claude.rs e codex.rs).
export type Permission = "readOnly" | "acceptEdits" | "fullAccess";

export interface RunRequest {
  provider: ProviderKind;
  prompt: string;
  /** Id da conversa no CLI. Ausente = conversa nova. */
  sessionId?: string;
  cwd: string;
  permission: Permission;
}

export type ProviderEvent =
  | { kind: "sessionStarted"; sessionId: string }
  | { kind: "textDelta"; text: string }
  | { kind: "toolUse"; name: string; detail: string }
  | { kind: "error"; message: string }
  | { kind: "done"; ok: boolean };

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  /** Linha de ferramenta (ex.: Bash com o comando executado). */
  tool?: { name: string; detail: string };
  error?: string;
}
