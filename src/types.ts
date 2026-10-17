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
  /** Modelo da lista da CLI. Ausente = padrão da CLI. */
  model?: string;
  /** Nível de esforço com o nome da CLI. Ausente = padrão. */
  effort?: string;
}

/// Nível de esforço de um modelo (ver src-tauri/src/models.rs). `id` é o valor enviado à CLI.
export interface EffortOption {
  id: string;
  label: string;
  recommended: boolean;
}

/// Modelo listado para o seletor (ver src-tauri/src/models.rs).
export interface ModelOption {
  id: string;
  label: string;
  description: string | null;
  efforts: EffortOption[];
}

export type ProviderEvent =
  | { kind: "sessionStarted"; sessionId: string }
  | { kind: "textDelta"; text: string }
  | { kind: "toolUse"; name: string; detail: string }
  | { kind: "rateLimit"; window: "fiveHour" | "sevenDay"; utilization: number; resetsAt: number }
  | { kind: "context"; tokens: number; windowSize: number }
  | { kind: "error"; message: string }
  | { kind: "done"; ok: boolean };

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  /** Linha de ferramenta (ex.: Bash com o comando executado). */
  tool?: { name: string; detail: string };
  error?: string;
}

/// Espelha src-tauri/src/conversations.rs (Conversation). Mensagens seguem o formato de ChatMessage.
export interface Conversation {
  id: string;
  title: string;
  provider: ProviderKind;
  sessionId?: string;
  cwd: string;
  permission: Permission;
  model?: string;
  effort?: string;
  planning: boolean;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

/// Linha da barra lateral (sem as mensagens).
export interface ConversationSummary {
  id: string;
  title: string;
  provider: ProviderKind;
  cwd: string;
  updatedAt: number;
}

/// Arquivo alterado na pasta de trabalho (ver src-tauri/src/changes.rs).
export interface ChangedFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "untracked";
  additions: number | null;
  deletions: number | null;
}

export interface Changes {
  isRepo: boolean;
  files: ChangedFile[];
}
