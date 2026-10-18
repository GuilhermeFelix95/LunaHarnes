import { useEffect, useRef, useState } from "react";
import { ArrowDown, GitCompare, Globe, Terminal } from "lucide-react";
import {
  cancelPrompt,
  checkAuth,
  getChanges,
  getWorkspace,
  apiPresets,
  checkpointPreview,
  checkpointRestore,
  checkpointTake,
  apiProfileHasKey,
  listApiProfiles,
  listFiles,
  listModels,
  listSlashItems,
  saveAttachment,
  saveFileAttachment,
  onProviderEvent,
  PLUGINS_CHANGED,
  PROFILES_CHANGED,
  openLogin,
  pickWorkspace,
  sendPrompt,
  listGitBranches,
  createGitWorktree,
  configFingerprint,
  MCP_CHANGED,
  SKILLS_CHANGED,
} from "../../api";
import { agentKey, agentOptions } from "../../chat/agents";
import { profileModelOptions } from "../../chat/models";
import { contextFor, withContext } from "../../chat/handoff";
import { autoCompactEnabled, compactPreamble, COMPACT_PROMPT, needsCompaction, sessionsFrom } from "../../chat/compact";
import { APPROVAL_PROMPT, APPROVE_OPTION, contextUnderstood, extractPlan, loadPlanTarget, planFromReply, QUESTION_PROTOCOL, streamingPlan, withPlanInstruction } from "../../chat/planning";
import { extractQuestions, type Question, type ReplyParts } from "../../chat/questions";
import { applyEvent } from "../../chat/reducer";
import { summarize, type CacheUsage, type TurnRecord } from "../../chat/promptCache";
import { longCacheEnabled } from "../../chat/cacheSettings";
import { useStickToBottom } from "../../chat/useStickToBottom";
import { PluginHost, type PluginMode } from "../../plugins/host";
import { notifyIfUnfocused } from "../../notifications";
import { cliPrompt, filterSlash, LUNA_COMMANDS, parseLunaCommand, slashQuery, type SlashItem } from "../../chat/slash";
import { extractPluginOffer } from "../../chat/pluginOffer";
import { PluginOfferCard } from "./PluginOfferCard";
import { playReplySound } from "../../sounds";
import { showToast } from "../../ui/toast";
import { loadInstalledPlugins } from "../../plugins/loader";
import type {
  AgentSessions,
  ApiPreset,
  ApiProfile,
  ChatMessage,
  Compaction,
  Conversation,
  ModelOption,
  Permission,
  ProviderKind,
} from "../../types";
import { applyTaskEvent, displayTodos, toTodos, type TaskEntry } from "../../chat/tasks";
import { ChangesPanel } from "../changes/ChangesPanel";
import { LoginPrompt } from "../auth/LoginPrompt";
import { BrowserPanel } from "../side/BrowserPanel";
import { loadOpen, RightPanel, saveOpen, type SideTab } from "../side/RightPanel";
import { TerminalPanel } from "../terminal/TerminalPanel";
import { Composer, PROVIDER_LABELS } from "./Composer";
import { MessageList } from "./MessageList";
import { QuestionPicker } from "./QuestionPicker";
import { UsageMeter, type LimitState, type ContextState } from "./UsageMeter";
import { WorkspaceChip } from "./WorkspaceChip";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { saveLastWorkspace } from "../../workspace";

const TITLE_MAX_CHARS = 60;

/// Sugestões da tela vazia: preenchem a caixa de mensagem, sem enviar sozinhas.
const SUGGESTIONS = ["Explique este projeto", "Encontre bugs", "Escreva testes"];

interface ChatViewProps {
  /** Conversa aberta do histórico. Ausente = conversa nova. */
  initial?: Conversation;
  /** Pasta de uma conversa nova. Ausente = pasta de onde o luna foi rodado. */
  startCwd?: string;
  /** Pastas de conversas anteriores, para o menu de troca. */
  recentFolders?: string[];
  /** Chamado ao fim de cada turno, com a conversa inteira, para salvar em disco. */
  onPersist: (conversation: Conversation) => void;
  /** Avisa a barra lateral quando esta conversa começa ou termina uma resposta. */
  onRunning?: (conversationId: string, running: boolean) => void;
}

export function ChatView({ initial, startCwd, recentFolders = [], onPersist, onRunning }: ChatViewProps) {
  const [conversationId] = useState(() => initial?.id ?? crypto.randomUUID());
  const createdAt = useRef(initial?.createdAt ?? Date.now());

  const [provider, setProvider] = useState<ProviderKind>(initial?.provider ?? "claude");
  // Perfil de API escolhido (null = login da CLI). O agente da conversa é o motor mais o perfil.
  const [profileId, setProfileId] = useState<string | null>(initial?.profile ?? null);
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [presets, setPresets] = useState<ApiPreset[]>([]);
  const [costUsd, setCostUsd] = useState(initial?.costUsd ?? 0);
  const costRef = useRef(costUsd);
  const [permission, setPermission] = useState<Permission>(initial?.permission ?? "acceptEdits");
  const [cwd, setCwd] = useState(initial?.cwd ?? startCwd ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [effort, setEffort] = useState(initial?.effort ?? "");
  // Modo plano começa desligado: só liga com o clique em Planejar.
  const [planning, setPlanning] = useState(initial?.planning ?? false);
  // Último plano da conversa: a resposta do modo plano (ou da spec) fica no painel.
  const [plan, setPlan] = useState<string | undefined>(initial?.plan);
  const planRef = useRef(plan);
  // O turno em andamento é de planejamento? Só a resposta desse turno vira plano.
  const turnPlanning = useRef(false);
  // Só turnos de planejamento e do modo Conversar mostram perguntas no seletor; nos outros, ficam como texto.
  const turnAsk = useRef(false);
  // Chave do cache para o turno que está para começar, e a do turno em andamento (null = não guarda).
  // Cache de prompt: o uso do turno chega antes do done; o livro guarda os turnos da conversa.
  const turnUsage = useRef<CacheUsage | null>(null);
  const turnMeta = useRef({ provider: "claude" as ProviderKind, model: "", systemKey: "" });
  const cacheTurns = useRef<TurnRecord[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(initial?.messages ?? []);
  const messagesRef = useRef(messages);
  const live = useRef({ provider, profileId, cwd, permission, model, effort, planning, running: false, sideTab: "changes" as SideTab });
  const [draft, setDraft] = useState("");
  /// Pede à conversa um resumo. Quando ele chega, a próxima mensagem começa uma sessão nova com ele.
  function compact() {
    if (running || messagesRef.current.length === 0) return;
    compactPending.current = true;
    void run("Compactar conversa", COMPACT_PROMPT, false);
  }

  /// Pasta de um plugin à espera de instalação: o cartão aparece acima do composer.
  const [pluginOffer, setPluginOffer] = useState<string | undefined>(undefined);
  // Sugestões do @arquivo para o trecho digitado depois do último "@".
  const [files, setFiles] = useState<string[]>([]);
  const fileRequest = useRef(0);
  // Arquivos escolhidos no @ desde o último envio: o pedido recebe a lista deles.
  const picked = useRef(new Set<string>());
  // Imagens do próximo envio: o arquivo já está na pasta de anexos; a url é só a miniatura.
  const [attachments, setAttachments] = useState<{ id: number; path: string; url: string }[]>([]);
  const attachmentSeq = useRef(0);
  // Arquivos gerais (não imagem) do próximo envio: o caminho entra no pedido e o agente lê.
  const [fileAttachments, setFileAttachments] = useState<{ id: number; name: string; path: string }[]>([]);
  const [running, setRunning] = useState(false);
  // Contexto cheio depois de um turno: compacta antes de o usuário precisar pedir.
  useEffect(() => {
    if (running || !compactDue.current) return;
    compactDue.current = false;
    compact();
    // compact só lê o estado da renderização atual; roda quando o turno termina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  // Perguntas do agente, mostradas no seletor. `questionsRound` muda a cada conjunto novo e recria o seletor.
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [questionsRound, setQuestionsRound] = useState(0);
  /// Quanto do contexto o agente diz já ter, lido da última resposta do modo plano ("Contexto entendido: X%").
  const [understood, setUnderstood] = useState<number | null>(null);
  // MCP, skill ou plugin instalado pela Luna no turno: a tela oferece recarregar. A impressão digital é tirada antes e depois do turno.
  const configBefore = useRef<string | null>(null);
  const [configChanged, setConfigChanged] = useState(false);
  // Branches da pasta, para o menu de pasta. Fora de um repositório git a lista fica vazia.
  const [branches, setBranches] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(() => listGitBranches(cwd))
      .then(
        (list) => alive && setBranches(list),
        () => alive && setBranches([]),
      );
    return () => {
      alive = false;
    };
  }, [cwd]);
  useEffect(() => {
    onRunning?.(conversationId, running);
  }, [running]);
  const [notes, setNotes] = useState<string[]>([]);
  /// Volta no tempo esperando a confirmação do usuário.
  const [pendingRewind, setPendingRewind] = useState<{ index: number; checkpoint: string; text: string } | null>(null);
  const [host] = useState(() => new PluginHost());
  // Modos que os plugins oferecem; o escolhido vale só para o próximo envio.
  const [modes, setModes] = useState<PluginMode[]>([]);
  const [modeId, setModeId] = useState("");
  const responseText = useRef("");
  // Sessão nativa de cada agente e quanto do histórico ele já viu (ver chat/handoff.ts).
  const sessions = useRef<AgentSessions>(initialSessions(initial));
  // Agente do turno em andamento: os eventos da CLI não dizem de quem são.
  const turnProvider = useRef<ProviderKind>(provider);
  // Chave do agente do turno (ver chat/agents.ts) e nome do perfil, para marcar as respostas.
  const turnAgent = useRef<string>(agentKey(provider, profileId));
  const turnLabel = useRef<string | undefined>(undefined);
  // Aviso que vai à frente do próximo pedido depois de voltar a um checkpoint.
  const rewindNote = useRef<string | null>(null);
  // Autor das respostas salvas antes de cada mensagem guardar o agente.
  const legacyProvider = useRef<ProviderKind>(initial?.provider ?? provider);
  // null = ainda não verificado; false = precisa entrar na conta.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [loginError, setLoginError] = useState<string | undefined>(undefined);
  // Painel da direita: aberto ou não, e qual aba.
  const [sideOpen, setSideOpen] = useState(loadOpen);
  const [sideTab, setSideTab] = useState<SideTab>("changes");
  useEffect(() => saveOpen(sideOpen), [sideOpen]);
  // Abre o terminal na primeira vez; depois ele só esconde, para não perder o shell.
  const [terminalOpened, setTerminalOpened] = useState(false);
  const [changesVersion, setChangesVersion] = useState(0);
  live.current = { provider, profileId, cwd, permission, model, effort, planning, running, sideTab };
  const [limits, setLimits] = useState<LimitState>({});
  const [context, setContext] = useState<ContextState | null>(null);
  // Tarefas do agente na resposta atual (aba Progresso), na ordem em que foram criadas.
  const [tasks, setTasks] = useState<TaskEntry[]>(() => initial?.tasks ?? []);
  // Ref para o listener, que é registrado uma vez: ele lê a lista atual daqui.
  const tasksRef = useRef<TaskEntry[]>(tasks);
  // Compactações da conversa: a última define onde começa a sessão nova (ver compact.ts).
  const [compactions, setCompactions] = useState<Compaction[]>(() => initial?.compactions ?? []);
  const compactionsRef = useRef<Compaction[]>(compactions);
  // compactPending: o próximo turno concluído é o resumo. compactDue: o contexto encheu, compactar depois do turno.
  const compactPending = useRef(false);
  const compactDue = useRef(false);
  const body = useRef<HTMLDivElement>(null);
  const { stuck, scrollToBottom } = useStickToBottom(body, messages);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        toggleTerminal();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // toggleTerminal só usa setters do React, que não mudam entre renderizações.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /// Abre o painel na aba pedida; se ela já está à mostra, fecha o painel.
  function toggleSide(tab: SideTab) {
    if (tab === "terminal") setTerminalOpened(true);
    setSideOpen((open) => !(open && live.current.sideTab === tab));
    setSideTab(tab);
  }

  function toggleTerminal() {
    toggleSide("terminal");
  }

  // O StrictMode roda este efeito duas vezes em desenvolvimento: a carga dos plugins acontece uma vez só,
  // senão o mesmo modo seria registrado duas vezes no host.
  const pluginsLoad = useRef<Promise<void> | null>(null);
  useEffect(() => {
    if (!pluginsLoad.current) pluginsLoad.current = loadInstalledPlugins(host);
    void pluginsLoad.current.then(() => {
      setModes(host.modeList());
      setNotes(host.messages());
    });
    if (!cwd) {
      void getWorkspace().then(setCwd).catch((e) => setNotes([String(e)]));
    }
  }, [host]);

  useEffect(() => {
    void verifyLogin();
  }, [provider, profileId]);

  // Configurações instalou, removeu ou ligou/desligou um plugin: recarrega na hora, mesmo com resposta em andamento.
  // Um plugin desligado não pode ficar ativo até o fim da resposta: o reset já tira os hooks dele.
  useEffect(() => {
    const reload = () => {
      host.reset();
      void loadInstalledPlugins(host).then(() => {
        setModes(host.modeList());
        setNotes(host.messages());
      });
    };
    window.addEventListener(PLUGINS_CHANGED, reload);
    return () => window.removeEventListener(PLUGINS_CHANGED, reload);
  }, [host]);

  // Perfis e presets: recarregados quando a página de configurações muda a lista.
  useEffect(() => {
    const reload = () => {
      Promise.all([listApiProfiles(), apiPresets()])
        .then(([list, known]) => {
          setProfiles(list);
          setPresets(known);
        })
        .catch((e) => setNotes((current) => [...current, String(e)]));
    };
    reload();
    window.addEventListener(PROFILES_CHANGED, reload);
    return () => window.removeEventListener(PROFILES_CHANGED, reload);
  }, []);

  useEffect(() => {
    let active = true;
    // Perfil: os modelos que o usuário listou nele. Sem perfil: a lista que a CLI expõe.
    const profile = profileId ? profiles.find((p) => p.id === profileId) : undefined;
    const source: Promise<ModelOption[]> = profileId ? Promise.resolve(profileModelOptions(profile)) : listModels(provider);
    source
      .then((list) => {
        if (!active) return;
        setModels(list);
        // Sem escolha válida, usa o primeiro modelo da lista.
        const chosen = list.find((m) => m.id === live.current.model) ?? list.find((m) => m.default) ?? list[0];
        const supported = chosen?.efforts.map((e) => e.id) ?? [];
        setModel(chosen?.id ?? "");
        if (!supported.includes(live.current.effort)) setEffort("");
      })
      .catch((e) => {
        if (active) setNotes((current) => [...current, String(e)]);
      });
    return () => {
      active = false;
    };
  }, [provider, profileId, profiles]);

  useEffect(() => {
    const unlisten = onProviderEvent(conversationId, (event) => {
      const turn = turnAgent.current;
      if (event.kind === "sessionStarted") {
        sessions.current = {
          ...sessions.current,
          [turn]: { id: event.sessionId, seen: sessions.current[turn]?.seen ?? 0 },
        };
      }
      if (event.kind === "textDelta") responseText.current += event.text;
      if (event.kind === "rateLimit") {
        setLimits((current) => ({
          ...current,
          [event.window]: { utilization: event.utilization, resetsAt: event.resetsAt },
        }));
      }
      if (event.kind === "context") {
        setContext({ tokens: event.tokens, windowSize: event.windowSize ?? undefined });
        // O próprio turno de resumo não dispara outro resumo.
        if (!compactPending.current && needsCompaction(event.tokens, event.windowSize ?? undefined) && autoCompactEnabled()) {
          compactDue.current = true;
        }
      }
      if (event.kind === "todos" || event.kind === "taskCreated" || event.kind === "taskAssigned" || event.kind === "taskUpdated") {
        tasksRef.current = applyTaskEvent(tasksRef.current, event);
        setTasks(tasksRef.current);
      }
      if (event.kind === "cost") {
        costRef.current += event.usd;
        setCostUsd(costRef.current);
      }
      // No plano, o texto do bloco luna-plano vai direto para o painel enquanto chega; o chat fica sem ele.
      const planStream = event.kind === "textDelta" && turnPlanning.current ? streamingPlan(responseText.current) : null;
      if (planStream !== null) {
        planRef.current = planStream;
        setPlan(planStream);
        setSideOpen(true);
        setSideTab("plan");
      } else {
        commit(applyEvent(messagesRef.current, event, turnProvider.current, turnLabel.current));
      }
      if (event.kind === "cacheUsage") {
        turnUsage.current = { fresh: event.fresh, read: event.read, write: event.write };
      }
      if (event.kind === "error") {
        void notifyIfUnfocused("Erro na resposta", "Uma resposta falhou. Abra a conversa para ver o motivo.");
        showToast({ kind: "error", title: "Erro na resposta", body: "Abra a conversa para ver o motivo." });
      }
      if (event.kind === "done") {
        const usage = turnUsage.current;
        turnUsage.current = null;
        if (usage) recordTurn(usage, sessions.current[turn]?.id ?? null);
        // Plano concluído: a lista de progresso fecha. Um plano novo abre outra (ver approvePlan).
        if (tasksRef.current.length > 0 && tasksRef.current.every((t) => t.status === "completed")) {
          tasksRef.current = [];
          setTasks([]);
        }
        const firstUser = messagesRef.current.find((m) => m.role === "user");
        const subject = firstUser ? truncate(firstUser.text, 40) : "a conversa";
        void notifyIfUnfocused(
          live.current.planning ? "Plano pronto para revisar" : "Resposta pronta",
          `"${subject}" terminou.`,
        );
        if (event.ok) playReplySound();
        if (event.ok) {
          showToast({
            kind: "success",
            title: live.current.planning ? "Plano pronto para revisar" : "Resposta pronta",
            body: `"${subject}" terminou.`,
          });
        }
        const session = sessions.current[turn];
        // O agente viu tudo até o fim deste turno.
        if (session) sessions.current = { ...sessions.current, [turn]: { ...session, seen: messagesRef.current.length } };
        // Resumo pronto: a sessão antiga é descartada, e a próxima mensagem começa uma nova com o resumo.
        if (compactPending.current) {
          compactPending.current = false;
          if (event.ok && responseText.current.trim()) {
            compactionsRef.current = [...compactionsRef.current, { at: messagesRef.current.length, summary: responseText.current }];
            setCompactions(compactionsRef.current);
            sessions.current = {};
            setNotes((current) => [...current, "Conversa compactada: a próxima mensagem começa com o resumo."]);
          }
        }
        setRunning(false);
        setChangesVersion((v) => v + 1);
        checkConfig();
        // O bloco de perguntas sai do texto e vira o seletor; o resto da resposta fica no chat.
        const parsed: ReplyParts = turnAsk.current
          ? extractQuestions(responseText.current)
          : { text: responseText.current, questions: null };
        if (parsed.warning) setNotes((current) => [...current, parsed.warning!]);
        if (turnPlanning.current) setUnderstood(contextUnderstood(responseText.current));
        if (parsed.questions) {
          const last = messagesRef.current.at(-1);
          if (last?.role === "assistant") commit([...messagesRef.current.slice(0, -1), { ...last, text: parsed.text }]);
          setQuestions(parsed.questions);
          setQuestionsRound((n) => n + 1);
        }
        // Plugin criado pela Luna: o bloco vira um cartão para instalar, e o texto segue sem o bloco.
        const offer = extractPluginOffer(parsed.text);
        if (offer) {
          const last = messagesRef.current.at(-1);
          if (last?.role === "assistant") commit([...messagesRef.current.slice(0, -1), { ...last, text: offer.text }]);
          setPluginOffer(offer.folder);
        }
        // Vira plano a resposta sem perguntas, ou a que pede a aprovação (a aprovação é a última pergunta do plano).
        // Rodadas de perguntas não mexem no plano: o agente ainda está entendendo o contexto.
        // O plano completo vai para o painel; no chat fica só o resumo de 3 linhas.
        const planParts = turnPlanning.current ? extractPlan(parsed.text) : null;
        if (planParts) {
          const last = messagesRef.current.at(-1);
          if (last?.role === "assistant" && !last.tool) {
            commit([...messagesRef.current.slice(0, -1), { ...last, text: planParts.summary }]);
          } else if (planParts.summary) {
            // O plano chegou todo no painel: o resumo entra no chat como resposta nova.
            commit(applyEvent(messagesRef.current, { kind: "textDelta", text: planParts.summary }, turnProvider.current, turnLabel.current));
          }
        }
        const draft = planParts?.plan ?? planFromReply(parsed, turnPlanning.current);
        if (draft) {
          planRef.current = draft;
          setPlan(draft);
          setSideOpen(true);
          setSideTab("plan");
        }
        persist(messagesRef.current);
        void host.runAfterResponse(responseText.current).then(() => setNotes(host.messages()));
      }
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [host, conversationId]);

  function commit(next: ChatMessage[]) {
    messagesRef.current = next;
    setMessages(next);
  }

  function persist(current: ChatMessage[]) {
    if (current.length === 0) return;
    const firstUser = current.find((m) => m.role === "user");
    const title = firstUser ? truncate(firstUser.text, TITLE_MAX_CHARS) : "Nova conversa";
    // Lido da ref: o listener de eventos é registrado uma vez e não vê valores novos pelo closure.
    const latest = live.current;
    saveLastWorkspace(latest.cwd);
    onPersist({
      id: conversationId,
      title,
      provider: latest.provider,
      sessionId: sessions.current[agentKey(latest.provider, latest.profileId)]?.id,
      sessions: sessions.current,
      cwd: latest.cwd,
      permission: latest.permission,
      model: latest.model || undefined,
      effort: latest.effort || undefined,
      planning: latest.planning,
      profile: latest.profileId ?? undefined,
      costUsd: costRef.current || undefined,
      plan: planRef.current,
      tasks: tasksRef.current,
      compactions: compactionsRef.current,
      createdAt: createdAt.current,
      updatedAt: Date.now(),
      messages: current,
    });
  }

  async function verifyLogin() {
    setChecking(true);
    try {
      setLoggedIn(profileId ? await apiProfileHasKey(profileId) : await checkAuth(provider));
      setLoginError(undefined);
    } catch (e) {
      setLoggedIn(false);
      setLoginError(String(e));
    } finally {
      setChecking(false);
    }
  }

  /// Trocar de pasta encerra a conversa atual: o id de sessão pertence à pasta anterior.
  function switchWorkspace(path: string) {
    if (path === cwd) return;
    setCwd(path);
    saveLastWorkspace(path);
    sessions.current = {};
    cacheTurns.current = [];
    host.setCacheSummary(null);
    commit([]);
  }

  async function browseWorkspace() {
    const picked = await pickWorkspace(cwd);
    if (picked) switchWorkspace(picked);
  }

  /// Trabalhar numa branch: cria a worktree dela (ou a branch nova, a partir da atual) e troca a conversa para a pasta nova.
  async function pickBranch(branch: string, isNew: boolean) {
    try {
      const path = await createGitWorktree(cwd, branch, isNew);
      switchWorkspace(path);
    } catch (e) {
      showToast({ kind: "error", title: "Worktree não criada", body: String(e) });
    }
  }

  /// Envia um turno. `shown` aparece na conversa; `cliPrompt` é o que o CLI recebe.
  /// No modo plano, o CLI recebe a instrução de planejamento e roda só com leitura.
  /// Se o agente ainda não viu parte do histórico (troca de agente), o contexto vai antes da mensagem.
  /// Tira a impressão digital da configuração antes do turno. Falha só fica sem comparação, não trava o envio.
  function snapshotConfig() {
    configBefore.current = null;
    Promise.resolve()
      .then(() => configFingerprint())
      .then(
        (fingerprint) => {
          configBefore.current = fingerprint;
        },
        (e) => setNotes((current) => [...current, `Não foi possível ler a configuração: ${String(e)}`]),
      );
  }

  /// Depois do turno: se a configuração mudou, avisa as listas (MCP, skills, plugins) e oferece recarregar o app.
  function checkConfig() {
    const before = configBefore.current;
    configBefore.current = null;
    if (before === null) return;
    Promise.resolve()
      .then(() => configFingerprint())
      .then(
        (now) => {
          if (now === before) return;
          window.dispatchEvent(new Event(MCP_CHANGED));
          window.dispatchEvent(new Event(SKILLS_CHANGED));
          window.dispatchEvent(new Event(PLUGINS_CHANGED));
          setConfigChanged(true);
        },
        (e) => setNotes((current) => [...current, `Não foi possível verificar a configuração: ${String(e)}`]),
      );
  }

  async function run(shown: string, cliPrompt: string, plan: boolean, mode?: PluginMode, images: string[] = []) {
    setRunning(true);
    snapshotConfig();
    if (rewindNote.current) {
      cliPrompt = `${rewindNote.current}

${cliPrompt}`;
      rewindNote.current = null;
    }
    responseText.current = "";
    // Cada resposta monta o próprio checklist; o da resposta anterior não fica na aba.
    // As tarefas são da conversa inteira (o Claude Code as mantém na sessão): não zeram a cada envio.
    // O painel abre no Progresso enquanto a Luna trabalha.
    setSideOpen(true);
    setSideTab("progress");
    setQuestions(null);
    setUnderstood(null);
    turnPlanning.current = plan;
    // Perguntas: o modo diz se quer perguntas. "ask" continua valendo para o plugin antigo, que não declarava o campo.
    turnAsk.current = plan || (mode?.questions ?? mode?.id === "ask");
    turnUsage.current = null;
    turnMeta.current = { provider, model: model ?? "", systemKey: [provider, profileId ?? "", model ?? "", effort ?? ""].join("|") };
    turnProvider.current = provider;
    turnAgent.current = agentKey(provider, profileId);
    turnLabel.current = profileId ? options.find((o) => o.key === turnAgent.current)?.label : undefined;
    const history = messagesRef.current;
    const userMsg: ChatMessage = { role: "user", text: shown, at: Date.now() };
    commit([...history, userMsg]);
    // Quem envia quer ver a resposta: volta a seguir o fim.
    scrollToBottom();
    setNotes(host.messages());

    try {
      // Checkpoint antes de qualquer alteração do agente: é o ponto para o qual "Voltar até aqui" leva.
      const checkpoint = await checkpointTake(cwd).catch(() => null);
      if (checkpoint) commit(messagesRef.current.map((m) => (m === userMsg ? { ...m, checkpoint } : m)));
      const key = turnAgent.current;
      // Depois de uma compactação, só vale a sessão criada depois dela, e o histórico começa nela.
      const since = compactionsRef.current.at(-1);
      const cut = since?.at ?? 0;
      const visible = history.slice(cut);
      const sessionsSinceCut = sessionsFrom(sessions.current, cut);
      const behind = (sessionsSinceCut[key]?.seen ?? 0) < visible.length;
      const changes = behind ? await getChanges(cwd).catch(() => null) : null;
      const context = contextFor({
        sessions: sessionsSinceCut,
        target: key,
        history: visible,
        fallback: legacyProvider.current,
        cwd,
        changes,
      });
      const sessionId = context.sessionId;
      const preamble = since && !sessionId ? [compactPreamble(since.summary), context.preamble].filter(Boolean).join("\n\n") : context.preamble;
      await sendPrompt({
        provider,
        profile: profileId ?? undefined,
        images,
        prompt: withContext(
          preamble,
          plan ? withPlanInstruction(cliPrompt, loadPlanTarget()) : mode ? mode.instruction + "\n\n" + QUESTION_PROTOCOL + "\n\n" + cliPrompt : cliPrompt,
        ),
        sessionId,
        cwd,
        permission: plan || mode ? "readOnly" : permission,
        model: model || undefined,
        effort: effort || undefined,
        contextWindow: models.find((m) => m.id === model)?.contextWindow,
        longCache: longCacheEnabled(),
      }, conversationId);
    } catch (e) {
      setRunning(false);
      commit(applyEvent(messagesRef.current, { kind: "error", message: String(e) }));
      persist(messagesRef.current);
    }
  }

  /// Anexa um arquivo: imagens viram miniatura; os demais ficam na lista, com o nome. Ambos vão para a pasta de anexos.
  async function attachFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setNotes([`${file.name}: arquivo maior que 10 MB`]);
      return;
    }
    const image = ["image/png", "image/jpeg", "image/webp"].includes(file.type);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const id = ++attachmentSeq.current;
      if (image) {
        const path = await saveAttachment(file.name, btoa(binary));
        setAttachments((current) => [...current, { id, path, url: URL.createObjectURL(file) }]);
      } else {
        const path = await saveFileAttachment(file.name, btoa(binary));
        setFileAttachments((current) => [...current, { id, name: file.name, path }]);
      }
    } catch (e) {
      setNotes([String(e)]);
    }
  }

  function removeAttachment(id: number) {
    const gone = attachments.find((a) => a.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    setAttachments((current) => current.filter((a) => a.id !== id));
  }

  function removeFileAttachment(id: number) {
    setFileAttachments((current) => current.filter((f) => f.id !== id));
  }

  // Menu de `/`: comandos da Luna, de plugin e as skills/comandos da CLI. As da CLI são lidas quando o menu abre.
  const [cliSlash, setCliSlash] = useState<SlashItem[]>([]);
  const slashText = slashQuery(draft);
  const slashOpen = slashText !== null;
  useEffect(() => {
    if (!slashOpen) return;
    let cancelled = false;
    listSlashItems(cwd, provider)
      .then((items) => {
        if (!cancelled) setCliSlash(items);
      })
      .catch(() => {
        if (!cancelled) setCliSlash([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slashOpen, cwd, provider]);
  const pluginSlash: SlashItem[] = host.commandNames().map((name) => ({
    name,
    description: "Comando de plugin",
    origin: "plugin",
  }));
  const slashMatches = slashText === null ? [] : filterSlash([...LUNA_COMMANDS, ...pluginSlash, ...cliSlash], slashText);

  /// Escolher um item põe `/nome ` no campo, para o usuário completar o pedido.
  function pickSlash(item: SlashItem) {
    setDraft(`/${item.name} `);
  }

  /// Digitar "@" abre a lista de arquivos do projeto; o trecho depois do "@" filtra.
  function changeDraft(value: string) {
    setDraft(value);
    const match = /@([^s@]*)$/.exec(value);
    const request = ++fileRequest.current;
    if (!match) {
      setFiles([]);
      return;
    }
    listFiles(cwd, match[1])
      .then((list) => {
        if (request === fileRequest.current) setFiles(list);
      })
      .catch(() => {
        if (request === fileRequest.current) setFiles([]);
      });
  }

  /// Escolhe um arquivo da lista: o "@" digitado vira o caminho completo.
  function pickFile(path: string) {
    setDraft((current) => current.replace(/@([^s@]*)$/, () => `@${path} `));
    picked.current.add(path);
    setFiles([]);
  }

  async function send() {
    const typed = draft.trim();
    const hasAnyAttachment = attachments.length > 0 || fileAttachments.length > 0;
    if ((!typed && !hasAnyAttachment) || running || loggedIn !== true) return;
    // Só com anexo, o pedido vai com uma frase padrão; os arquivos entram na lista abaixo.
    const prompt = typed || "Veja os anexos.";
    setDraft("");

    // `/plano` liga o modo de planejamento e não vai ao provedor.
    // `/plugin instalar <pasta>` abre o mesmo cartão de instalação que a Luna mostra depois de criar um plugin.
    const luna = parseLunaCommand(prompt);
    if (luna?.id === "plano") {
      setPlanning(true);
      return;
    }
    if (luna?.id === "compactar") {
      setDraft("");
      compact();
      return;
    }
    if (luna?.id === "plugin") {
      setPluginOffer(luna.folder);
      return;
    }

    // Comando de plugin (`/nome args`): se devolver texto, esse texto é o que vai ao provedor.
    const command = await host.handleCommand(prompt);
    if (command.handled && command.prompt === undefined) {
      setNotes(host.messages());
      return;
    }
    // Skill ou comando da CLI (`/nome args`) vai como a CLI o entende; o que o usuário vê continua o mesmo.
    const outgoing = await host.runBeforeSend(command.handled ? command.prompt! : (cliPrompt(prompt, cliSlash) ?? prompt));
    // Arquivos citados com o "@" entram no pedido por nome, para o agente saber que devem ser lidos.
    const mentioned = [...picked.current].filter((p) => prompt.includes(`@${p}`));
    picked.current.clear();
    // Arquivos anexados (caminho na pasta de anexos) e citados com "@" entram juntos na lista de leitura.
    const readPaths = [...mentioned, ...fileAttachments.map((f) => f.path)];
    const withFiles =
      readPaths.length > 0
        ? `Arquivos citados no pedido (leia antes de responder): ${readPaths.join(", ")}

${outgoing}`
        : outgoing;
    // Modo de plugin: só leitura e com a instrução do modo na frente do pedido.
    // As imagens vão com este envio; a lista de anexos volta a vazia.
    const imagePaths = attachments.map((a) => a.path);
    const mode = modes.find((m) => m.id === modeId);
    attachments.forEach((a) => URL.revokeObjectURL(a.url));
    setAttachments([]);
    setFileAttachments([]);
    await run(prompt, withFiles, planning, mode, imagePaths);
  }

  /// Guarda o uso de cache do turno e atualiza o resumo que o painel de cache lê (via host).
  function recordTurn(usage: CacheUsage, sessionId: string | null) {
    const meta = turnMeta.current;
    const now = Date.now();
    cacheTurns.current = [...cacheTurns.current, { usage, at: now, model: meta.model, systemKey: meta.systemKey, sessionId }];
    host.setCacheSummary(summarize(cacheTurns.current, { provider: meta.provider, longTtl: longCacheEnabled(), now }));
  }

  /// Volta os arquivos ao início deste turno e tira a conversa daquele ponto para baixo.
  /// O texto do pedido volta para o campo de envio, para o usuário poder reenviar ou editar.
  async function rewind(index: number, checkpoint: string) {
    if (running) return;
    let plan;
    try {
      plan = await checkpointPreview(cwd, checkpoint);
    } catch (e) {
      setNotes([String(e)]);
      return;
    }
    const text =
      plan.removed.length + plan.restored.length === 0
        ? "Nenhum arquivo muda; a conversa volta a este ponto."
        : `${plan.restored.length} arquivo(s) voltam ao que eram e ${plan.removed.length} criado(s) depois serão apagados. As mensagens a partir daqui saem da conversa.`;
    setPendingRewind({ index, checkpoint, text });
  }

  /// Depois da confirmação: restaura os arquivos e corta a conversa no ponto escolhido.
  async function doRewind({ index, checkpoint }: { index: number; checkpoint: string }) {
    try {
      await checkpointRestore(cwd, checkpoint);
    } catch (e) {
      setNotes([String(e)]);
      return;
    }
    const kept = messagesRef.current.slice(0, index);
    const text = messagesRef.current[index].text;
    commit(kept);
    // Sem sessão nativa, o próximo envio reenvia o histórico que sobrou, em texto.
    sessions.current = {};
    rewindNote.current = "Os arquivos foram restaurados para um ponto anterior desta conversa. Considere só o estado atual.";
    setDraft(text);
    persist(kept);
    setChangesVersion((n) => n + 1);
  }

  /// Respostas do seletor: viram a próxima mensagem do turno, no mesmo modo em que estava a conversa.
  async function answerQuestions(text: string) {
    if (running) return;
    // No modo plano, escolher a opção de aprovação encerra o planejamento e executa, como o botão faz.
    if (planning && text.split("\n").some((line) => line.endsWith(`: ${APPROVE_OPTION}`) || line === APPROVE_OPTION)) {
      await approvePlan();
      return;
    }
    await run(text, text, planning, modes.find((m) => m.id === modeId));
  }

  /// Aprovação do plano: sai do modo plano e manda o agente executar com a permissão escolhida.
  async function approvePlan() {
    if (running || loggedIn !== true) return;
    setPlanning(false);
    // Execução nova: a lista de progresso começa do zero, sem as etapas de um plano anterior.
    tasksRef.current = [];
    setTasks([]);
    await run("Plano aprovado.", APPROVAL_PROMPT, false);
  }

  function changeModel(next: string) {
    setModel(next);
    // Nível que o novo modelo não aceita volta para o padrão.
    const supported = models.find((m) => m.id === next)?.efforts.map((e) => e.id) ?? [];
    if (!supported.includes(effort)) setEffort("");
  }

  const agentK = agentKey(provider, profileId);
  const options = agentOptions(profiles, presets);
  const agentLabel = options.find((o) => o.key === agentK)?.label ?? PROVIDER_LABELS[provider];

  /// Troca de agente: a conversa continua, e o novo agente recebe o histórico no próximo envio.
  function changeAgent(key: string) {
    const next = options.find((o) => o.key === key);
    if (!next) return;
    setProvider(next.engine);
    setProfileId(next.profileId ?? null);
    setModel("");
    setEffort("");
  }

  // Sem conta conectada ou sem pasta de trabalho ainda carregada, não há como enviar.
  const blocked = loggedIn !== true || !cwd;
  const lastIsReply = messages.at(-1)?.role === "assistant";
  const modelWindow = models.find((m) => m.id === model)?.contextWindow;

  return (
    <div className="chat">
      <div data-plugin-slot="chat" />
      {pendingRewind && (
        <ConfirmDialog
          title="Voltar até aqui?"
          body={pendingRewind.text}
          confirmLabel="Voltar"
          danger
          onCancel={() => setPendingRewind(null)}
          onConfirm={() => {
            const target = pendingRewind;
            setPendingRewind(null);
            void doRewind(target);
          }}
        />
      )}
      <header className="chat__header">
        <h2 className="chat__title">{messages.length > 0 ? titleOf(messages) : "Nova conversa"}</h2>
        {host.commandNames().length > 0 && (
          <span className="chat__commands">
            Comandos: {host.commandNames().map((c) => `/${c}`).join(", ")}
          </span>
        )}
        {costUsd > 0 && (
          <span className="chat__cost">
            {costUsd.toLocaleString("pt-BR", { style: "currency", currency: "USD" })} nesta conversa
          </span>
        )}
        <div className="chat__tools">
          <button
            type="button"
            className="chat__tool"
            aria-pressed={sideOpen && sideTab === "changes"}
            onClick={() => toggleSide("changes")}
          >
            <GitCompare size={14} aria-hidden="true" /> Alterações
          </button>
          <button
            type="button"
            className="chat__tool"
            aria-pressed={sideOpen && sideTab === "plan"}
            onClick={() => toggleSide("plan")}
          >
            Plano
          </button>
          <button
            type="button"
            className="chat__tool"
            aria-pressed={sideOpen && sideTab === "terminal"}
            title="Terminal (Ctrl+`)"
            onClick={toggleTerminal}
          >
            <Terminal size={14} aria-hidden="true" /> Terminal
          </button>
          <button
            type="button"
            className="chat__tool"
            aria-pressed={sideOpen && sideTab === "browser"}
            title="Navegador"
            onClick={() => toggleSide("browser")}
          >
            <Globe size={14} aria-hidden="true" /> Navegador
          </button>
        </div>
      </header>

      <div className="chat__split">
      <div className="chat__column">
      <div className="chat__body" ref={body}>
        {loggedIn === false && profileId && (
          <p role="alert" className="chat__notes">
            Este perfil ainda não tem chave. Cole a chave em Configurações &gt; Provedores.
          </p>
        )}
        {loggedIn === false && !profileId && (
          <LoginPrompt
            provider={provider}
            onLogin={() => {
              openLogin(provider).catch((e) => setLoginError(String(e)));
            }}
            onCheck={() => void verifyLogin()}
            checking={checking}
            error={loginError}
          />
        )}

        {notes.length > 0 && (
          <ul className="chat__notes" aria-label="Avisos">
            {notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        )}

        {messages.length === 0 ? (
          <div className="chat__empty">
            <img src="/luna/atom.png" alt="" className="chat__logo" />
            <h1>Como posso ajudar?</h1>
            <p>
              {planning
                ? "Modo de planejamento: o agente pergunta antes de editar nada."
                : `Conversando com ${agentLabel}.`}
            </p>
            {planning && (
              <button type="button" className="chat__skip" onClick={() => setPlanning(false)}>
                Pular entrevista
              </button>
            )}
            {!planning && (
              <div className="chat__suggestions">
                {SUGGESTIONS.map((text) => (
                  <button key={text} type="button" onClick={() => setDraft(text)}>
                    {text}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <MessageList
            messages={messages}
            fallbackProvider={legacyProvider.current}
            running={running}
            pending={{ provider, label: agentLabel }}
            onRewind={(m) => {
              const index = messagesRef.current.indexOf(m);
              if (index >= 0 && m.checkpoint) void rewind(index, m.checkpoint);
            }}
          />
        )}

        {!stuck && messages.length > 0 && (
          <button type="button" className="chat__to-end" onClick={scrollToBottom}>
            Ir para o fim <ArrowDown size={13} aria-hidden="true" />
          </button>
        )}

        {planning && lastIsReply && !running && (
          <div className="plan-approval" role="region" aria-label="Aprovação do plano">
            <p className="plan-approval__context">
              {understood === null
                ? "Contexto entendido: o agente não informou."
                : `Contexto entendido: ${understood}% de ${loadPlanTarget()}% necessários para o plano.`}
            </p>
            <p>Quando o plano estiver pronto, aprove para o agente começar a editar os arquivos.</p>
            <button type="button" onClick={() => void approvePlan()} disabled={blocked}>
              Aprovar e executar
            </button>
          </div>
        )}

      </div>

      {/* Acima da caixa de mensagem, como no Claude Desktop: fica fora da lista de mensagens. */}
      {questions && !running && (
        <QuestionPicker
          key={questionsRound}
          questions={questions}
          onAnswer={(text) => void answerQuestions(text)}
          onDismiss={() => setQuestions(null)}
        />
      )}

      {configChanged && (
        <section className="plugin-offer" role="status" aria-label="Configuração mudou">
          <p>
            <strong>A Luna instalou ou mudou um MCP, skill ou plugin.</strong> Recarregue o app para ele valer em tudo.
          </p>
          <div className="api-form__actions">
            <button type="button" disabled={running} onClick={() => window.location.reload()}>
              Recarregar
            </button>
            <button type="button" onClick={() => setConfigChanged(false)}>
              Depois
            </button>
          </div>
        </section>
      )}

      {pluginOffer && (
        <PluginOfferCard
          folder={pluginOffer}
          onInstalled={(message) => {
            setPluginOffer(undefined);
            setNotes((current) => [...current, message]);
          }}
          onDismiss={() => setPluginOffer(undefined)}
        />
      )}

      <Composer
        draft={draft}
        onDraft={changeDraft}
        attachments={attachments}
        onAttach={(file) => void attachFile(file)}
        onRemoveAttachment={removeAttachment}
        fileAttachments={fileAttachments.map(({ id, name }) => ({ id, name }))}
        onRemoveFileAttachment={removeFileAttachment}
        files={files}
        onPickFile={pickFile}
        onSend={() => void send()}
        onStop={() => void cancelPrompt(conversationId)}
        running={running}
        blocked={blocked}
        agent={agentK}
        agents={options}
        onAgent={changeAgent}
        permission={permission}
        onPermission={setPermission}
        models={models}
        model={model}
        onModel={changeModel}
        effort={effort}
        onEffort={setEffort}
        modes={modes}
        mode={modeId}
        onMode={setModeId}
        planning={planning}
        onTogglePlanning={() => setPlanning((on) => !on)}
        slash={slashMatches}
        onPickSlash={pickSlash}
      />
      <div className="chat__foot">
        <WorkspaceChip
          cwd={cwd}
          recent={recentFolders}
          disabled={running}
          onPick={switchWorkspace}
          onBrowse={() => void browseWorkspace()}
          branches={branches}
          onPickBranch={(branch, isNew) => void pickBranch(branch, isNew)}
        />
        {provider === "claude" && (
          <UsageMeter
            // Limites de conta são da assinatura da CLI; um perfil de API não tem.
            limits={profileId ? {} : limits}
            // Com perfil de API, a janela vem do modelo escolhido; sem ela, o medidor mostra só os tokens.
            context={context && { tokens: context.tokens, windowSize: profileId ? modelWindow : context.windowSize }}
            windowHint={profileId && !modelWindow ? "Atualize a lista de modelos para ver a janela" : undefined}
          />
        )}
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          title="Resume a conversa para liberar o contexto (também /compactar)"
          disabled={running || messages.length === 0}
          onClick={compact}
        >
          Compactar
        </button>
      </div>
      </div>

      <RightPanel
        open={sideOpen}
        onClose={() => setSideOpen(false)}
        tab={sideTab}
        onTab={(tab) => {
          if (tab === "terminal") setTerminalOpened(true);
          setSideTab(tab);
        }}
        changes={cwd ? <ChangesPanel cwd={cwd} version={changesVersion} /> : null}
        plan={plan}
        todos={displayTodos(toTodos(tasks), running)}
        running={running}
        terminal={terminalOpened && cwd ? <TerminalPanel key={cwd} cwd={cwd} /> : null}
        browser={<BrowserPanel active={sideOpen && sideTab === "browser"} />}
      />
      </div>
    </div>
  );
}

/// Sessões de uma conversa salva. Arquivos antigos só têm `sessionId`, que o agente viu até o fim.
function initialSessions(initial?: Conversation): AgentSessions {
  if (initial?.sessions) return initial.sessions;
  if (initial?.sessionId) {
    return { [agentKey(initial.provider, initial.profile)]: { id: initial.sessionId, seen: initial.messages.length } };
  }
  return {};
}

/// Título da conversa: a primeira mensagem do usuário, já truncada.
function titleOf(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  return first ? truncate(first.text, TITLE_MAX_CHARS) : "Nova conversa";
}

function truncate(text: string, max: number): string {
  const single = text.replace(/\s+/g, " ").trim();
  return single.length > max ? `${single.slice(0, max - 1)}…` : single;
}
