import type { ConversationSummary } from "../../types";

export interface ConversationGroup {
  label: "Hoje" | "Ontem" | "Anteriores";
  items: ConversationSummary[];
}

/// Agrupa conversas (já ordenadas da mais recente) em Hoje, Ontem e Anteriores.
/// Grupos vazios não aparecem.
export function groupByDay(items: ConversationSummary[], now: Date): ConversationGroup[] {
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<ConversationGroup["label"], ConversationSummary[]> = {
    Hoje: [],
    Ontem: [],
    Anteriores: [],
  };

  for (const item of items) {
    const day = startOfDay(new Date(item.updatedAt));
    if (day.getTime() === today.getTime()) groups.Hoje.push(item);
    else if (day.getTime() === yesterday.getTime()) groups.Ontem.push(item);
    else groups.Anteriores.push(item);
  }

  return (Object.keys(groups) as ConversationGroup["label"][])
    .filter((label) => groups[label].length > 0)
    .map((label) => ({ label, items: groups[label] }));
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
