# Decisões

## Rodada 1
- No Claude, como o modo 'Pedir permissão' deve funcionar?: Pop-up no chat antes de cada ação sensível, pelo mecanismo de permissão da própria CLI
- E nos motores que não têm pop-up de permissão (Codex, OpenCode e outros)?: Mostrar o pop-up só onde a CLI suportar e, onde não suportar, usar Só leitura
- A troca do padrão para 'Acesso total' vale para quais conversas?: Só conversas novas
- Como a velocidade real (tokens por segundo) deve aparecer durante a resposta?: Ao vivo no Claude, usando a contagem de saída do stream; nos outros motores, só o valor final do turno
- Como as alterações de arquivo devem aparecer no chat, como no Claude Code?: Diff inline no chat para cada arquivo editado, recolhível, com +linhas e −linhas

## Rodada 2
- Na sidebar do modo navegador, o que você quer?: Recolher a lista de conversas em ícones e corrigir o corte
- No modo navegador, o agente só conversa e resume a página. Quer esconder o seletor de permissão e as ações de edição do composer nesse modo?: Sim, esconder
- Para descobrir a causa do erro do OpenCode, como devo proceder?: Investigar pelo código e rodar o OpenCode com uma tentativa depois da aprovação
- Onde o clonador de sites deve aparecer?: deve aparecer no modo lunacode, ao lado de laterações
- O que o clonador deve copiar de uma página?: Layout, cores, componentes e animações, perguntando ao final se mantém as cores do site ou usa as do projeto

## Rodada 3
- Onde o clonador de sites deve aparecer, ao lado de Alterações?: um botao que ao clicar abre a seidebar pra isneir a url do site e depois de clcoanr mostra o preivew do site da pessoa
- Quais melhorias no modo navegador você quer no próximo ciclo?: quando importo favoritos deveria aparecer na barra de favoritos e senha devem ser copaidas de fato ao pimportar senha esobre outras melhorias opr enquantoa penas o que é essencial pr aum bom navegador pr apreender a pessoa e usar o meu app como navegador
- O clonador deve mostrar um aviso de direitos autorais antes de copiar o visual de um site?: Sim, mostrar aviso e permitir

## Rodada 4
- Quando você diz que as senhas devem ser copiadas de fato ao importar, o que espera?: Preencher o login automaticamente nas páginas que eu abrir
- Quais itens entram no próximo ciclo como essenciais para o navegador?: Histórico com busca, Favoritos sempre visíveis na barra, Botões de voltar, avançar e recarregar sempre visíveis, Atalhos de teclado (Ctrl+T nova aba, Ctrl+W fechar, Ctrl+L barra de endereço), o atalho do ctrl + F abre a barra de endereço no meio do app como é no mac nesse estilo

## Rodada 5
- Como o preenchimento automático deve funcionar?: Sugerir o login da página e preencher só quando eu clicar
- O que o Ctrl+F deve fazer no modo navegador?: Abrir uma barra de endereço flutuante no meio da tela, como o Spotlight do Mac

## Rodada 6
- Como o site será clonado?: O agente recria o site do zero com o que foi capturado
- Onde o clone deve ser salvo?: Dentro da pasta do projeto atual, numa subpasta com o nome escolhido
- O que o seletor do clonador deve oferecer para copiar?: Layout e estrutura, Cores, Componentes, Tipografia, Animações, Textos e imagens
- Nas cores, o que usar?: Manter as cores do site
- Como a prévia deve aparecer?: Só a prévia

## Rodada 7
- 1. O que não deve ser compartilhado entre o chat do navegador e a Luna do LunaCode?: Os dois: histórico e instruções
- 2. Como o chat do navegador deve falar sobre o que pode fazer?: Só o que o modo faz hoje
- 3. Quais capacidades a Luna do navegador deve saber explicar? (pode marcar mais de uma): Resumir a página, Explicar o conteúdo da página, Preencher formulários, O agente agir na página conforme o pedido, Buscar na web, Gerenciar favoritos e histórico
- 4. Como o seletor de esforço deve aparecer no cartão de IA do navegador?: Só quando o modelo escolhido tiver níveis de esforço, como no Orquestrador
