/// Plugin que a Luna criou: a resposta traz um bloco `luna-plugin` com a pasta do rascunho.
/// O app mostra um cartão para instalar, com a tela de permissões; o bloco sai do texto.
export interface PluginOffer {
  /// Texto da resposta sem o bloco.
  text: string;
  /// Caminho da pasta do plugin, como a Luna escreveu.
  folder: string;
}

const BLOCK = /```luna-plugin\s*\n([\s\S]*?)\n```/;

/// Separa o bloco do texto. Sem bloco, ou com JSON sem a pasta, devolve null e a resposta fica como está.
export function extractPluginOffer(reply: string): PluginOffer | null {
  const match = BLOCK.exec(reply);
  if (!match) return null;
  let folder: unknown;
  try {
    folder = (JSON.parse(match[1]) as { pasta?: unknown }).pasta;
  } catch {
    return null;
  }
  if (typeof folder !== "string" || folder.trim() === "") return null;
  return { text: reply.replace(match[0], "").trim(), folder: folder.trim() };
}

/// Nome da pasta para mostrar no cartão: o último trecho do caminho.
export function folderName(folder: string): string {
  return folder.split(/[\\/]/).filter(Boolean).pop() ?? folder;
}
