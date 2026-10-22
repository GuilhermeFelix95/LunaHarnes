# Navegador branco, atraso do painel direito e aviso de atualização

## Problem Statement

Três problemas afetam o uso diário do app.

No modo navegador, a página fica branca ao entrar em qualquer endereço, desde o primeiro carregamento. O usuário não consegue ver o site que abriu.

Ao abrir o painel direito, todas as abas (Alterações, Navegador, Plano e Terminal) demoram a aparecer do mesmo jeito. A demora é perceptível a cada clique, mesmo quando a aba não tem dados pesados.

Quando sai uma versão nova, o app só avisa por um toast que some em cinco segundos e não tem ação. O usuário precisa lembrar de procurar em Configurações > Sobre para instalar, e o app não confere de novo enquanto fica aberto por horas.

## Solution

O navegador mostra a página que o usuário abriu, e continua mostrando depois de trocar de conversa ou de aba.

O painel direito abre sem atraso perceptível em qualquer aba.

Quando há uma versão nova, um indicador discreto aparece ao lado do botão de Configurações. O usuário clica, vê a versão disponível e pode baixar e instalar sem sair do fluxo. O app confere se há versão nova ao abrir e depois a cada hora.

## User Stories

1. Como usuário, quero entrar em uma página no navegador e vê-la carregada, para usar o navegador sem uma tela em branco.
2. Como usuário, quero trocar de conversa e voltar, e a página continuar visível, para não perder o que estava vendo.
3. Como usuário, quero abrir o painel direito e ver a aba aparecer na hora, para o app parecer rápido.
4. Como usuário, quero ver um sinal discreto ao lado de Configurações quando há versão nova, para saber que ela existe sem procurar.
5. Como usuário, quero baixar e instalar a versão nova a partir desse aviso, para atualizar com poucos cliques.
6. Como usuário, quero que o app confira se há versão nova sozinho a cada hora, para não depender de eu lembrar.
7. Como usuário, quero que as execuções e os terminais só sejam encerrados depois que o download termina, para não perder trabalho se o download falhar.

## Implementation Decisions

- O frontend é React com TypeScript e os estilos são arquivos CSS do próprio projeto, sem framework de estilos.
- O backend é Tauri 2 com Rust. Comandos e alterações no backend seguem o padrão de validação e de mensagem de erro já usado no projeto.
- A visibilidade da área do navegador é controlada só pela aba que está em uso. Painéis de outras conversas não escondem a página de quem está mostrando.
- Uma aba nova do navegador abre com a página carregada. Não fica em branco esperando uma navegação.
- O painel direito abre numa única etapa quando o modo navegador é ligado, sem um segundo passo visível.
- A animação do painel direito usa apenas transformação e opacidade, para não refazer o layout a cada quadro.
- A checagem de atualização acontece ao abrir o app e depois a cada hora. O resultado fica disponível para toda a interface, sem depender do toast.
- O aviso de atualização aparece como um indicador ao lado do botão de Configurações. O toast não é o único lugar que avisa.
- Instalar uma atualização baixa primeiro. Só depois do download concluído as execuções e os terminais em andamento são encerrados, e então a instalação começa.
- A chave pública e o endereço do atualizador não mudam. Versões já instaladas continuam verificando a assinatura do mesmo jeito.
- Textos novos entram nos dicionários de português do Brasil e inglês.
- Testes automatizados usam Vitest no frontend e cargo test no backend.

## Testing Decisions

Os testes verificam só o comportamento externo: o que o usuário vê e o que o backend devolve.

- Com duas conversas abertas, trocar de uma para a outra e voltar mantém a página do navegador visível.
- Uma aba nova do navegador mostra uma página carregada, não uma tela em branco.
- Ao ligar o modo navegador, o painel direito aparece na mesma troca, sem passo intermediário visível.
- O painel direito, ao abrir e fechar, não usa animação de largura: o movimento é de transformação e opacidade.
- Com versão nova disponível, o indicador aparece ao lado de Configurações. Sem versão nova, ele não aparece.
- Com a checagem agendada, uma nova verificação acontece depois de uma hora, sem nova ação do usuário.
- Ao clicar em baixar e instalar, o download acontece antes de qualquer execução ou terminal ser encerrado. Se o download falhar, nada é encerrado e a mensagem de erro aparece.
- Verificação manual: abrir uma página no navegador, trocar de conversa e voltar; abrir o painel direito em cada aba; conferir o indicador e a instalação com uma versão de teste.

## Out of Scope

- Publicar nova release. A publicação depende de aprovação explícita separada.
- Mudar a chave pública ou o endereço do atualizador.
- Mudar a lista de Alterações, salvo se a medição mostrar que ela é o gargalo.
- Bloqueador de anúncios e extensões do navegador.
- Canais de atualização (beta, prévia) e atualização automática sem o usuário clicar.

## Further Notes

- A causa da página em branco ainda precisa ser confirmada por um teste que a reproduza antes da correção.
- A atualização ponta a ponta (instalar uma versão antiga e atualizar para a nova) precisa ser testada antes de divulgar uma release.
- A regra de encerrar execuções só depois do download foi escolhida pelo usuário. Durante o download, o agente pode continuar rodando.
