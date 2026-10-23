# Spec: agente do navegador que age na página e pesquisa na web

## Problem Statement

O agente do navegador embutido só consegue navegar, ler a página, clicar e digitar. Clique e digitação dependem de um seletor CSS que o modelo precisa adivinhar. Por isso ele não consegue fechar um modal, como o de descrição de um canal do YouTube: não há como listar os botões da página, rolar, apertar Esc ou esperar um elemento aparecer. Também não pesquisa na web. Quem usa o navegador espera que o agente faça o que pedir na página, inclusive buscar sites e repositórios em tempo real.

## Solution

O agente passa a enxergar a página como uma lista de elementos interativos com referência, e age sobre essas referências: clicar, digitar, rolar, apertar teclas e esperar. Pode pesquisar na web com o motor escolhido em Configurações > Navegador e trocar de motor só quando a pesquisa não acha resultado. Antes de ações sensíveis, como comprar, enviar formulário, publicar ou apagar, pede confirmação no chat. Quando a página exige login, CAPTCHA ou confirmação de conta, o agente para e pede que a pessoa resolva na página. As ferramentas chegam a todos os motores de conversa que aceitam configuração de ferramentas (MCP).

## User Stories

1. Como usuário, quero que o agente feche um modal na página, mesmo que eu não diga qual botão clicar.
2. Como usuário, quero que o agente clique, digite e role a página por aquilo que vê nela, com texto, papel e posição.
3. Como usuário, quero que o agente possa apertar Esc, Enter e Tab, para fechar caixas e enviar formulários.
4. Como usuário, quero que o agente espere um elemento aparecer antes de agir, para não clicar no vazio.
5. Como usuário, quero que o agente pesquise sites e repositórios na web em tempo real, usando o motor que escolhi.
6. Como usuário, quero que o agente troque de motor de pesquisa só quando o meu motor não achar resultado.
7. Como usuário, quero aprovar ou negar no chat cada ação sensível, como comprar, enviar, publicar ou apagar.
8. Como usuário, quero que o agente pare quando a página pedir login, CAPTCHA ou confirmação de conta, e me avise para resolver.
9. Como usuário, quero que o agente do navegador funcione também em outros motores de conversa, e não só no Claude.
10. Como usuário, quero que o chat descreva só o que o modo navegador faz de fato.

## Implementation Decisions

- A página é lida e manipulada dentro da própria webview do app. O agente não abre um navegador separado.
- O agente age por referências temporárias geradas na leitura da página. Uma referência vale até a página mudar.
- A comunicação entre a página e o backend usa o canal HTTP local que já existe, protegido pelo token. A webview não recebe acesso aos comandos do app.
- A pesquisa usa o motor escolhido em Configurações > Navegador, enviado junto com cada envio, porque a escolha fica no armazenamento do front. Sem resultado, o agente tenta o próximo motor da lista do app.
- Ações sensíveis são classificadas pelo que o botão ou o formulário diz. Elas usam o mesmo canal de pedido de permissão que o modo Pedir permissão já usa.
- Login, CAPTCHA e confirmação de conta são detectados pela própria página. O agente recebe um aviso que o obriga a parar e pedir ajuda à pessoa.
- A configuração do navegador em cada motor segue o formato que o motor já usa para servidores de contexto. Motores que não confirmam esse suporte na documentação oficial ficam sem as ferramentas.
- A identidade do navegador descreve só as capacidades que existem no modo.
- Os textos novos existem em português e inglês.

## Testing Decisions

Os testes verificam só o comportamento externo: o que a pessoa e o agente observam.

- Em uma página com modal e botão Fechar, o agente consegue fechar o modal sem indicar o seletor.
- O agente lista os elementos clicáveis da página com o rótulo e o texto corretos.
- O agente rola a página e aperta Esc, e o efeito aparece na página.
- Uma espera termina quando o elemento aparece e falha com aviso quando não aparece.
- A pesquisa usa o motor escolhido. Sem resultado, usa o próximo motor.
- Uma ação sensível espera a decisão no chat. Permitir executa, e negar devolve a negativa ao agente.
- Num motor sem canal de aprovação, a ação sensível é recusada, e isso aparece para a pessoa.
- Em página de login, CAPTCHA ou confirmação de conta, o agente para e pede ajuda.
- O motor que recebe as ferramentas passa a ver o navegador do Luna como ferramenta disponível.
- A descrição do navegador no chat não cita capacidades que o modo não tem.

## Out of Scope

- Preenchimento automático de login sem clique da pessoa. Continua o comportamento atual de sugerir e preencher só quando a pessoa clicar.
- Mudanças no clonador de sites, na importação de favoritos e senhas, no histórico e no bloqueador de anúncios.
- Configuração de ferramentas em motores que não confirmam suporte na documentação oficial.
- Verificação automática em sites reais. A verificação no app é manual.
- Mudança na API pública de plugins.

## Further Notes

- Esta spec fica em `specs/009-navegador-agente`, e não em `specs/004`, porque `specs/004` já guarda a spec de permissões do projeto e não deve ser sobrescrita.
- Iframes e elementos dentro de sombra (shadow DOM) podem não aparecer na lista de elementos. Esse limite fica registrado.
- Sites com proteção anti-bot podem bloquear a leitura ou a pesquisa. Nesse caso o agente informa e para.
