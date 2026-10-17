import type { ConversationSummary } from "../../types";
import { groupByDay, type ConversationGroup } from "./groupByDay";

export interface ProjectGroup {
  /** Pasta completa: identifica o projeto. */
  cwd: string;
  /** Último nome da pasta, para mostrar na barra lateral. */
  name: string;
  /** Conversas do projeto, separadas por dia. */
  days: ConversationGroup[];
}

/// Agrupa conversas por pasta de trabalho. Projetos com conversa mais recente vêm primeiro.
export function groupByProject(items: ConversationSummary[], now: Date): ProjectGroup[] {
  const byCwd = new Map<string, ConversationSummary[]>();
  for (const item of items) {
    const list = byCwd.get(item.cwd) ?? [];
    list.push(item);
    byCwd.set(item.cwd, list);
  }

  return [...byCwd.entries()]
    .map(([cwd, list]) => {
      const newestFirst = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
      return {
        cwd,
        name: folderName(cwd),
        days: groupByDay(newestFirst, now),
        latest: newestFirst[0].updatedAt,
      };
    })
    .sort((a, b) => b.latest - a.latest)
    .map(({ latest: _latest, ...group }) => group);
}

/// Nome curto de uma pasta: o último segmento do caminho (aceita `\` e `/`).
export function folderName(cwd: string): string {
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? cwd;
}
