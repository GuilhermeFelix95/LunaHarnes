/// Menu de `/` do composer: comandos da Luna, comandos de plugin e skills/comandos da CLI.
export type SlashOrigin = "luna" | "plugin" | "skill" | "command";

export interface SlashItem {
  name: string;
  description: string;
  origin: SlashOrigin;
}

/// Comandos que o próprio app executa. `plugin instalar` leva o caminho da pasta depois do nome.
export const LUNA_COMMANDS: SlashItem[] = [
  { name: "plano", description: "Liga o modo de planejamento", origin: "luna" },
  { name: "compactar", description: "Resume a conversa para liberar o contexto", origin: "luna" },
  { name: "projeto", description: "Confere os arquivos do projeto que as CLIs leem (CLAUDE.md, AGENTS.md)", origin: "luna" },
  { name: "plugin instalar", description: "Instala o plugin de uma pasta, depois de revisar as permissões", origin: "luna" },
  { name: "subagente", description: "Roda uma tarefa em segundo plano no Claude enquanto a conversa segue (ex.: /subagente revisar os testes)", origin: "luna" },
];

export const ORIGIN_LABELS: Record<SlashOrigin, string> = {
  luna: "Luna",
  plugin: "Plugin",
  skill: "Skill",
  command: "Comando",
};

/// Trecho digitado depois da barra, enquanto o menu deve estar aberto (sem espaço ainda). Fora disso, null.
export function slashQuery(draft: string): string | null {
  if (!draft.startsWith("/")) return null;
  const body = draft.slice(1);
  if (/\s/.test(body)) return null;
  return body.toLowerCase();
}

/// Itens que combinam com o trecho: os que começam com ele primeiro, depois os que o contêm.
export function filterSlash(items: SlashItem[], query: string): SlashItem[] {
  const matches = items.filter((item) => item.name.toLowerCase().includes(query));
  return [
    ...matches.filter((item) => item.name.toLowerCase().startsWith(query)),
    ...matches.filter((item) => !item.name.toLowerCase().startsWith(query)),
  ];
}

export type LunaCommand =
  | { id: "plano" }
  | { id: "compactar" }
  | { id: "projeto" }
  | { id: "plugin"; folder: string }
  | { id: "subagente"; task: string };

/// Reconhece os comandos da Luna digitados. Qualquer outra entrada devolve null.
export function parseLunaCommand(input: string): LunaCommand | null {
  const text = input.trim();
  if (text === "/plano") return { id: "plano" };
  if (text === "/compactar") return { id: "compactar" };
  if (text === "/projeto") return { id: "projeto" };
  const install = /^\/plugin instalar\s+(.+)$/.exec(text);
  if (install) return { id: "plugin", folder: install[1].trim() };
  const subagent = /^\/subagente\s+(.+)$/s.exec(text);
  if (subagent) return { id: "subagente", task: subagent[1].trim() };
  return null;
}

/// Texto que vai à CLI para uma skill ou comando dela. Null quando a entrada não é um deles.
/// Skill vai como pedido em linguagem natural; comando vai com a barra, como a CLI o conhece.
export function cliPrompt(input: string, items: SlashItem[]): string | null {
  const text = input.trim();
  const item = items.find((i) => text === `/${i.name}` || text.startsWith(`/${i.name} `));
  if (!item) return null;
  const args = text.slice(item.name.length + 1).trim();
  if (item.origin === "skill") return `Use a skill ${item.name}${args ? `: ${args}` : ""}`;
  return `/${item.name}${args ? ` ${args}` : ""}`;
}
