/// Uma linha do diff com o número dela no arquivo antigo e no novo (null quando não existe em um deles).
export interface DiffLine {
  kind: "add" | "del" | "ctx" | "hunk";
  oldNo: number | null;
  newNo: number | null;
  text: string;
}

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/// Lê o texto do `git diff` em linhas numeradas. Os números saem dos cabeçalhos `@@`.
/// Cabeçalhos do git (diff --git, index, ---, +++) e "\ No newline" ficam de fora.
/// Arquivo novo sem nenhum `@@` (o conteúdo vem como linhas "+") conta a partir da linha 1.
export function parseDiffLines(diff: string): DiffLine[] {
  const lines = diff.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();

  if (!lines.some((line) => line.startsWith("@@"))) {
    return lines.map((text, i) => ({ kind: "add", oldNo: null, newNo: i + 1, text }));
  }

  const out: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  let inHunk = false;
  for (const text of lines) {
    const hunk = HUNK.exec(text);
    if (hunk) {
      oldNo = Number(hunk[1]);
      newNo = Number(hunk[2]);
      inHunk = true;
      out.push({ kind: "hunk", oldNo: null, newNo: null, text });
      continue;
    }
    if (!inHunk || text.startsWith("\\")) continue;
    if (text.startsWith("+")) {
      out.push({ kind: "add", oldNo: null, newNo, text });
      newNo += 1;
    } else if (text.startsWith("-")) {
      out.push({ kind: "del", oldNo, newNo: null, text });
      oldNo += 1;
    } else {
      out.push({ kind: "ctx", oldNo, newNo, text });
      oldNo += 1;
      newNo += 1;
    }
  }
  return out;
}
