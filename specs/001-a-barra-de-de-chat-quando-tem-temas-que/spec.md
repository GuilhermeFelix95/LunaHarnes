# Indicador deslizante nas Configurações e subagente em segundo plano

## Problem Statement

Duas limitações atrapalham o uso diário do app.

Nas Configurações, a troca de seção já tem uma animação de entrada, mas o menu lateral não indica movimento: o destaque do item ativo aparece e desaparece de uma vez, sem acompanhar a troca de seção. A navegação parece estática, e o usuário perde a referência de onde estava ao alternar entre seções.

Para tarefas longas, o chat só executa um turno por vez. Quando o agente precisa pesquisar, rodar testes ou revisar arquivos, a conversa fica ocupada até o fim, e o usuário não pode pedir outra coisa enquanto isso. Também não há como delegar uma tarefa e receber o resultado depois, sem prender a conversa.

## Solution

O menu lateral das Configurações ganha um indicador que desliza até o item ativo. O indicador é uma marca visual com o acento do tema, posicionada sobre o item atual, e o movimento usa a duração e a curva de animação já definidas pelo tema. Com movimento reduzido, o indicador salta para a nova posição sem animar.

No chat, um novo comando da Luna permite delegar uma tarefa a um processo próprio do motor Claude, iniciado pelo app. A conversa continua livre enquanto a tarefa roda. Uma lista na própria conversa mostra o status de cada tarefa e permite parar uma tarefa a qualquer momento. Quando a tarefa termina, a conversa recebe uma mensagem com o resultado, mesmo que outro turno esteja em andamento.

## User Stories

1. Como usuário, quero que o destaque do menu de Configurações deslize até a seção ativa, para enxergar a navegação como um movimento contínuo.
2. Como usuário, quero que o indicador use as cores e o formato do tema atual, para a navegação não destoar do restante do app.
3. Como usuário que prefere menos movimento, quero que o indicador não anime quando o sistema pede movimento reduzido.
4. Como usuário, quero delegar uma tarefa longa com um comando no chat e continuar conversando enquanto ela roda.
5. Como usuário, quero ver na conversa quais tarefas em segundo plano estão rodando, com o status de cada uma.
6. Como usuário, quero poder parar uma tarefa em segundo plano a qualquer momento.
7. Como usuário, quero receber o resultado da tarefa na conversa assim que ela terminar, sem precisar perguntar.
8. Como usuário, quero que o app recuse iniciar mais tarefas simultâneas do que o limite, com uma mensagem clara.
9. Como usuário de outro motor, quero que o recurso não altere o comportamento normal do chat.

## Implementation Decisions

- O frontend é React com TypeScript. Os estilos são arquivos CSS do próprio projeto, sem framework de estilos.
- O backend do app é Tauri 2 com Rust. Comandos novos seguem o mesmo padrão dos comandos já existentes: validação do lado Rust, retorno de erro com mensagem clara e registro no mesmo ponto de entrada.
- O indicador do menu é um elemento visual marcado como decorativo para leitores de tela. O estado da seção continua comunicado pelo item ativo do menu, que mantém a marcação de página atual.
- O indicador mede o item ativo depois de cada troca de seção e quando a janela muda de tamanho. A posição e a altura vêm dessa medição; o deslize é feito pela transição do CSS.
- A transição usa os tokens de duração e de curva do tema. O movimento reduzido, já tratado pelos tokens globais, zera a animação.
- Em janelas estreitas, o menu passa a ficar em linha e o indicador vertical é escondido; o item ativo volta a ter fundo próprio.
- O subagente em segundo plano é uma execução própria do motor Claude, iniciada pelo app, sem depender do processo do turno. O processo do turno continua encerrando ao fim do turno.
- O recurso existe só no motor Claude. Codex, OpenCode e os demais motores mantêm o comportamento atual.
- A tarefa em segundo plano usa a mesma pasta de trabalho e a mesma configuração de permissão do turno. Não usa o papel de subagente das etapas do plano, que continua com a função atual.
- O comando que inicia a tarefa é um comando da Luna, disponível no menu de barra do composer, com a tarefa escrita depois do nome.
- Há um limite de tarefas simultâneas. Acima do limite, o pedido é recusado com mensagem clara.
- Cada tarefa tem um identificador, um status e a saída produzida. Parar uma tarefa encerra o processo e muda o status para parada.
- O app acompanha a conclusão das tarefas e envia o resultado para a conversa na hora em que a tarefa termina. O resultado entra como mensagem própria, sem enviar nada ao agente e sem interromper um turno em andamento.
- A lista de tarefas em segundo plano aparece na conversa, com status e botão para parar cada tarefa.
- Ao fechar o app, as tarefas em segundo plano são encerradas.
- Textos novos entram nos dicionários de português do Brasil e inglês.
- Testes automatizados usam Vitest no frontend e cargo test no backend.

## Testing Decisions

Os testes verificam só o comportamento externo: o que o usuário vê e o que o backend devolve.

- O menu de Configurações contém o indicador, e ele é decorativo para leitores de tela.
- Ao trocar de seção, o indicador passa a apontar para o item ativo.
- O estilo do indicador usa os tokens de movimento do tema, e o movimento reduzido zera a duração.
- Um arquivo de teste confirma que o comando de tarefa em segundo plano aparece no menu e separa a tarefa do nome do comando.
- Um teste do backend confirma que, acima do limite, novas tarefas são recusadas com mensagem clara.
- Um teste do backend confirma que parar uma tarefa muda o status para parada.
- Um teste do backend confirma que a execução avulsa usa a pasta de trabalho da conversa e não usa a configuração do turno com o papel de subagente das etapas.
- Um teste da conversa confirma que a conclusão de uma tarefa vira mensagem na conversa.
- Um teste da conversa confirma que a mensagem de conclusão não interrompe um turno em andamento.
- Um teste da conversa confirma que o resultado da tarefa não é enviado de volta ao agente.
- Verificação manual: trocar de seção nas Configurações e observar o destaque deslizando; iniciar uma tarefa em segundo plano, continuar conversando e ver a mensagem de resultado quando ela terminar.

## Out of Scope

- Subagentes em segundo plano nos motores Codex e OpenCode.
- Subagentes aninhados ou tarefas iniciadas por outra tarefa em segundo plano.
- Histórico de tarefas em segundo plano entre sessões do app.
- Recuperar tarefas em segundo plano depois de fechar o app.
- Mostrar a saída parcial da tarefa durante a execução.
- Alterar o papel de subagente usado pelas etapas do plano.
- Alterar o fluxo normal do turno do chat.
- Mudar a criação, a remoção ou a listagem de worktrees.
- Cache de respostas, cache de prompt e plugin Cache de Tokens: são outra tarefa.
- Publicação, push ou merge das branches.

## Further Notes

- As duas mudanças ficam em branches separadas, ambas criadas a partir da main: uma para o indicador das Configurações e outra para o subagente em segundo plano.
- O indicador reaproveita a animação de entrada que a tela de Configurações e o painel de seção já têm.
- A conversa recebe o resultado da tarefa como mensagem separada. Se um turno estiver em andamento, a mensagem aparece sem alterar o turno.
- Sem resposta a um pedido de permissão, uma ação que exija confirmação falha. A falha aparece no status da tarefa.
- Cada tarefa em segundo plano consome tokens como uma execução completa. O limite de tarefas simultâneas e o botão de parar são as proteções previstas.
- Fechar o app encerra as tarefas em segundo plano; não há retomada depois de reabrir.
- A verificação manual depende de uma conta configurada no motor Claude.
