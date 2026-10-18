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
  /** Perfil de API (id em api-profiles.json). Ausente = login da própria CLI. A chave fica no cofre. */
  profile?: string;
  /** Caminhos das imagens anexadas, salvas pelo app (save_attachment). */
  images?: string[];
}

/// Perfil de API salvo, sem a chave (ver src-tauri/src/api_profiles.rs).
export interface ApiProfile {
  id: string;
  name: string;
  preset: string;
  /** Vazio = endereço padrão do preset. */
  baseUrl: string;
  models: string[];
  defaultModel: string | null;
  /** Só OpenRouter: "free" mostra no chat apenas os modelos com :free. */
  modelScope?: "all" | "free";
  /** Janela de contexto em tokens, por id de modelo, quando a API informou. */
  contextWindows?: Record<string, number>;
}

/// Provedor pronto para criar um perfil (ver `api_profiles::presets`).
/// Modelos que a API do provedor devolve. `cheapest` é null quando a API não informa preço.
export interface RemoteModels {
  ids: string[];
  cheapest: string | null;
  /** Janela de contexto em tokens, por id, quando a API informa. */
  contexts: Record<string, number>;
}

export interface ApiPreset {
  preset: string;
  label: string;
  engine: ProviderKind;
  defaultBaseUrl: string;
  /** Modelos que já vêm prontos no preset: o usuário só cola a chave. */
  suggestedModels: string[];
  /** Modelo padrão entre os sugeridos. Vazio = nenhum. */
  defaultModel: string;
  /** Modelos do provedor que o Claude Code não usa: aparecem marcados, não entram na lista. */
  unsupportedModels?: string[];
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
  /** Modelo escolhido quando a conversa não tem escolha: o mais barato do provedor. */
  default: boolean;
  /** Janela de contexto em tokens, quando a API informa. */
  contextWindow?: number;
}

/// Situação de uma CLI no computador (espelha setup::CliStatus em src-tauri/src/setup.rs).
export interface CliStatus {
  provider: ProviderKind;
  installed: boolean;
  /** Onde a CLI foi achada. Null = não instalada. */
  path: string | null;
}

/// Uma etapa do checklist do agente (espelha TodoItem em providers/mod.rs).
export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export type ProviderEvent =
  | { kind: "sessionStarted"; sessionId: string }
  | { kind: "textDelta"; text: string }
  | { kind: "toolUse"; name: string; detail: string }
  | { kind: "todos"; items: TodoItem[] }
  | { kind: "taskCreated"; key: string; subject: string }
  | { kind: "taskAssigned"; key: string; id: string }
  | { kind: "taskUpdated"; id: string; status: string | null; subject: string | null }
  | { kind: "rateLimit"; window: "fiveHour" | "sevenDay"; utilization: number; resetsAt: number }
  | { kind: "context"; tokens: number; windowSize: number | null }
  | { kind: "cost"; usd: number }
  | { kind: "error"; message: string }
  | { kind: "done"; ok: boolean };

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  /** Linha de ferramenta (ex.: Bash com o comando executado). */
  tool?: { name: string; detail: string };
  error?: string;
  /** Agente que respondeu. Ausente em conversas antigas = provedor da conversa. */
  provider?: ProviderKind;
  /** Nome do agente que respondeu, quando é um perfil de API (ex.: "DeepSeek · via Claude Code"). */
  agent?: string;
  /** Estado dos arquivos antes deste turno (só em mensagens do usuário, em repositório git). */
  checkpoint?: string;
}

/// Sessão nativa de um agente e quantas mensagens do histórico ele já viu (ver src/chat/handoff.ts).
export interface AgentSession {
  id: string;
  seen: number;
}

/// Chave: "claude", "codex" ou "api:<id do perfil>" (ver src/chat/agents.ts).
export type AgentSessions = Partial<Record<string, AgentSession>>;

/// Espelha src-tauri/src/conversations.rs (Conversation). Mensagens seguem o formato de ChatMessage.
export interface Conversation {
  id: string;
  title: string;
  /** Nome escolhido na barra lateral: salvar de novo não troca o título (ver conversations.rs). */
  titleLocked?: boolean;
  provider: ProviderKind;
  sessionId?: string;
  cwd: string;
  permission: Permission;
  model?: string;
  effort?: string;
  planning: boolean;
  /** Perfil de API da conversa. Ausente = login da CLI. */
  profile?: string;
  /** Custo acumulado em dólares, quando o uso é por API. */
  costUsd?: number;
  /** Último plano gerado nesta conversa (aba Plano do painel). */
  plan?: string;
  /** Sessões por agente. Ausente em arquivos antigos: vem de sessionId. */
  sessions?: AgentSessions;
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
