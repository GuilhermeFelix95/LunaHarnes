# Branch criada pelo chat, destaque da branch atual e miniatura de imagem no histórico

## Problem Statement

Três problemas afetam o uso diário do chat com projetos git:

- Quando o agente cria ou troca de branch pelo chat, o menu de branch não mostra a branch nova e a barra continua indicando a branch antiga. O usuário precisa trocar de pasta ou reabrir o app para ver o estado real do repositório.
- No menu de branch, a branch atual não se destaca das outras, então é difícil saber em qual branch a conversa está.
- Quando o usuário envia uma imagem, a miniatura aparece só durante o envio. Depois que a resposta chega, ela some do histórico, e some também ao recarregar a conversa.

Há ainda um quarto ponto ligado ao plano: etapas que o agente deixa em andamento ao fim de um turno ficam marcadas no painel de progresso, mesmo com o trabalho feito.

## Solution

O estado de branch passa a ser relido nos momentos em que ele pode ter mudado: ao fim do turno, quando um comando do agente termina e quando o usuário abre o menu de branch. A branch atual ganha destaque visual no menu. A mensagem do usuário guarda os caminhos das imagens enviadas, e o balão mostra a miniatura carregando a imagem da pasta de anexos do app. A instrução de aprovação do plano passa a pedir que o agente conclua todas as etapas antes de terminar.

## User Stories

1. Como usuário, quero que uma branch criada pelo agente no chat apareça no menu de branch assim que o comando termina, para escolher ou conferir sem sair da conversa.
2. Como usuário, quero que a barra de branch mostre a branch em que o agente está trabalhando, para não achar que a conversa ainda está na main quando não está.
3. Como usuário, quero ver claramente qual branch está marcada como atual no menu, para distinguir a atual das demais.
4. Como usuário, quero que a imagem que enviei continue aparecendo no histórico, na mensagem em que a enviei, mesmo depois de recarregar a conversa.
5. Como usuário, quero que, quando a imagem não estiver mais disponível, o histórico mostre um aviso curto no lugar, sem quebrar a conversa.
6. Como usuário, quero que o agente marque todas as etapas do plano como concluídas antes de terminar, para o painel de progresso refletir o trabalho feito.

## Implementation Decisions

- O frontend é React com TypeScript. Os estilos são arquivos CSS do próprio projeto, sem framework de estilos.
- O backend do app é Tauri 2 com Rust. Comandos novos seguem o mesmo padrão dos comandos já existentes: validação do lado Rust, retorno de erro com mensagem clara e registro no mesmo ponto de entrada.
- Nenhum comando novo aceita caminho arbitrário: a leitura de imagem só alcança a pasta de anexos do próprio app.
- Só imagens de tipo png, jpeg e webp são lidas. Há limite de tamanho por arquivo.
- A lista de branches e a branch atual são relidas quando a pasta muda, ao fim de cada turno, ao abrir o menu de branch e quando um comando do agente termina.
- Criar e listar worktrees continua igual. Muda só o momento em que o estado é relido.
- A mensagem do usuário guarda somente os caminhos das imagens enviadas, não os bytes. Os bytes ficam na pasta de anexos e são lidos quando o balão é exibido.
- Conversas salvas antes desta mudança não têm caminhos de imagem e não ganham miniatura.
- O campo de imagens da mensagem é opcional, para que conversas antigas continuem sendo lidas sem migração.
- A instrução de concluir etapas fica no texto de aprovação do plano. Nenhuma mudança automática no app marca etapas como concluídas.
- Textos novos entram nos dicionários de português do Brasil e inglês.
- Testes automatizados usam Vitest no frontend e cargo test no backend.

## Testing Decisions

Os testes verificam só o comportamento externo: o que o usuário vê e o que o backend devolve.

- Depois de um turno em que o agente cria uma branch, o menu de branch lista a branch nova sem o usuário trocar de pasta.
- Depois do mesmo turno, a barra de branch mostra a branch em que o agente está.
- No menu de branch, a branch atual aparece destacada e marcada como atual para leitores de tela.
- Ao abrir o menu de branch, a lista atual é carregada, mesmo que nada tenha mudado desde a última abertura.
- Um caminho de imagem fora da pasta de anexos é recusado com uma mensagem clara.
- Um arquivo de imagem válido na pasta de anexos volta como imagem para exibir.
- Um arquivo que não é imagem, ou maior que o limite, é recusado.
- Uma mensagem do usuário enviada com imagens mostra a miniatura no balão.
- A mesma mensagem, carregada de novo da conversa salva, continua mostrando a miniatura.
- Quando a imagem não existe mais, o balão mostra o aviso curto no lugar da miniatura, sem erro na tela.
- A conversa salva antes da mudança abre normalmente, sem miniatura e sem erro.
- O texto de aprovação do plano pede que todas as etapas sejam marcadas como concluídas antes do fim do turno.
- Verificação manual: criar uma branch pelo chat e ver o menu atualizar com destaque; enviar uma imagem e ver a miniatura antes e depois de recarregar a conversa.

## Out of Scope

- Miniaturas de imagens de conversas antigas: não há caminho guardado para recuperar.
- Recuperar imagens cuja pasta de anexos foi apagada.
- Fechar etapas automaticamente no app quando o agente não as fecha.
- Mudanças em criação, remoção ou listagem de worktrees, além do momento de recarregar.
- Cache de respostas, cache de prompt e plugin Cache de Tokens: são outra tarefa.
- Publicação, push ou merge da branch.

## Further Notes

- A branch de trabalho é fix/branch-imagem-progresso, criada a partir da main.
- Os motores que não emitem o evento de comando concluído recebem a atualização ao fim do turno e ao abrir o menu.
- Diferenças de comportamento entre motores (Claude, Codex e outros) são verificadas na execução com cada um, quando houver conta disponível.
- A pasta de anexos é a mesma usada pelo envio de imagens; qualquer mudança nela afeta as miniaturas.
