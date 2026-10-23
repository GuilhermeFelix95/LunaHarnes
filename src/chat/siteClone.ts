import type { SiteCapture } from "../api";
import type { Question } from "./questions";

/// Clonador de sites: as perguntas do fluxo, a validação do nome da pasta e o pedido que vai ao agente.
/// Função pura, sem React nem Tauri, para ser testada sozinha.

export const CLONE_PARTS = ["Layout e estrutura", "Cores", "Componentes", "Tipografia", "Animações", "Textos e imagens"] as const;

/// Destino do clone. Os rótulos não têm dois-pontos, porque a resposta do seletor usa ":" como separador.
export const CLONE_TARGET_FOLDER = "Criar uma subpasta com o nome escolhido";
export const CLONE_TARGET_PROJECT = "Usar o projeto atual, criando componentes e regras de cores, layout e animações";

const TARGET_QUESTION = "Onde o clone deve ficar?";
const PARTS_QUESTION = "O que você quer clonar deste site?";

const FOLDER_NAME = /^[\p{L}\p{N} _-]+$/u;
const MAX_FOLDER_NAME = 60;

/// Perguntas do seletor: primeiro o destino (subpasta ou projeto atual), depois o que copiar.
/// O que copiar é seleção múltipla, com "Layout e estrutura" marcada como recomendada.
export function cloneQuestions(): Question[] {
  return [
    {
      question: TARGET_QUESTION,
      options: [CLONE_TARGET_FOLDER, CLONE_TARGET_PROJECT],
      multiple: false,
    },
    {
      question: PARTS_QUESTION,
      options: [...CLONE_PARTS],
      multiple: true,
      recommended: "Layout e estrutura",
    },
  ];
}

export interface CloneAnswer {
  /** true quando o clone vai para o projeto atual, sem subpasta. */
  inProject: boolean;
  parts: string[];
}

/// Lê a resposta do seletor, uma pergunta por linha ("Pergunta: opção, opção"); só valem as opções conhecidas.
export function parseCloneAnswer(answer: string): CloneAnswer {
  const [targetLine = "", partsLine = ""] = answer.split("\n");
  const parts = partsLine
    .slice(partsLine.indexOf(":") + 1)
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is (typeof CLONE_PARTS)[number] => (CLONE_PARTS as readonly string[]).includes(part));
  return { inProject: targetLine.includes(CLONE_TARGET_PROJECT), parts };
}

export type FolderNameCheck = { ok: true; name: string } | { ok: false; reason: string };

/// Nome da subpasta do clone: letras, números, espaço, hífen e sublinhado. Sem separador de caminho nem ponto,
/// assim não há como sair da pasta do projeto.
export function checkFolderName(raw: string): FolderNameCheck {
  const name = raw.trim();
  if (!name) return { ok: false, reason: "Dê um nome para a pasta do clone." };
  if (name.length > MAX_FOLDER_NAME) return { ok: false, reason: `O nome pode ter até ${MAX_FOLDER_NAME} caracteres.` };
  if (!FOLDER_NAME.test(name)) {
    return { ok: false, reason: "Use só letras, números, espaço, hífen ou sublinhado." };
  }
  return { ok: true, name };
}

export interface ClonePlan {
  url: string;
  /** Nome da subpasta do clone; null quando o clone vai para o projeto atual. */
  folder: string | null;
  parts: readonly string[];
  capture: Pick<SiteCapture, "title" | "colors" | "keyframes" | "components" | "cssVariables" | "embeddedCss">;
}

/// Texto enviado ao agente. Leva o que foi capturado e as partes escolhidas; o agente recria o site do zero.
export function buildClonePrompt(plan: ClonePlan): string {
  const has = (part: string) => plan.parts.includes(part);
  const chosen = plan.parts.length ? plan.parts.join(", ") : "Layout e estrutura";
  const where = plan.folder
    ? `Salve o resultado na pasta ${plan.folder}/ do projeto atual, com um arquivo index.html que contenha o CSS e o JavaScript embutidos.`
    : "Crie no código do projeto atual os componentes e as regras de CSS (cores, layout e animações) que recriam o visual, seguindo as convenções que ele já usa. Não crie subpasta nem um HTML completo.";
  const lines = [
    `Clone o site ${plan.url} e recrie-o do zero, sem copiar o código-fonte original.`,
    where,
    `Copie somente: ${chosen}.`,
    `Título da página original: ${plan.capture.title || "sem título"}.`,
  ];
  // Só entra o que foi capturado e escolhido: o pedido não traz dados de partes que a pessoa não quer.
  if (has("Cores")) {
    lines.push(`Use as cores do site: ${plan.capture.colors.length ? plan.capture.colors.join(" ") : "nenhuma cor encontrada"}.`);
    if (plan.capture.cssVariables.length) {
      lines.push(`Variáveis de cor do site: ${plan.capture.cssVariables.join("; ")}.`);
    }
  }
  if (has("Layout e estrutura") && plan.capture.embeddedCss) {
    lines.push(`CSS embutido na página (resumo): ${plan.capture.embeddedCss}`);
  }
  if (has("Componentes")) {
    lines.push(`Componentes identificados na página: ${plan.capture.components.length ? plan.capture.components.join(", ") : "nenhum componente encontrado"}.`);
  }
  if (has("Animações")) {
    lines.push(`Animações identificadas (@keyframes): ${plan.capture.keyframes}.`);
  }
  return lines.join("\n");
}
