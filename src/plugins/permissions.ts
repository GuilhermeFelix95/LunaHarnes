/// Explica cada permissão em português, para os diálogos de instalação.
export const PERMISSION_TEXT: Record<string, string> = {
  commands: "registra comandos com barra, como /nome",
  hooks: "lê e pode alterar o texto antes de enviar, e lê cada resposta",
  modes: "oferece um modo de somente leitura no composer",
  cache: "lê o resumo do cache de prompt da conversa (só leitura) e mostra avisos",
  ui: "pode ler e mudar qualquer parte da tela do app, inclusive o chat e a barra",
};
