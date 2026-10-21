# Abas de terminal e esforço do modelo no orquestrador

## Problem Statement

O terminal embutido no chat abre um único shell por vez. Quem precisa rodar dois comandos em paralelo, ou manter um shell de apoio enquanto trabalha em outro, precisa fechar o terminal atual para usar o outro.

No orquestrador, cada papel (planejamento, execução, conversa e subagente das etapas) escolhe motor e modelo, mas não há como escolher o nível de esforço. O modelo já aceita esse valor, então o usuário fica preso ao padrão, sem controle sobre custo e profundidade de raciocínio.

## Solution

O painel de terminal ganha um botão para abrir outro terminal. Cada terminal vira uma aba dentro do painel. Trocar de aba não encerra os shells das outras abas, e fechar uma aba encerra apenas o shell dela. O número de terminais abertos ao mesmo tempo é limitado a quatro, e o pedido de um quinto é recusado com uma mensagem clara.

Na tela do orquestrador, cada papel ganha um campo de esforço. O campo aparece somente quando o modelo escolhido tem níveis de esforço. Sem escolha, vale o padrão do modelo. Quando o esforço escolhido vale para o subagente das etapas, ele passa a ser levado ao subagente também.

## User Stories

1. Como usuário, quero abrir mais de um terminal no painel do chat, para rodar comandos em paralelo.
2. Como usuário, quero trocar entre os terminais abertos sem perder o histórico ou o estado de nenhum deles.
3. Como usuário, quero fechar um terminal sem afetar os outros.
4. Como usuário, quero ser avisado de forma clara quando já há quatro terminais abertos.
5. Como usuário, quero escolher o nível de esforço de cada papel do orquestrador.
6. Como usuário, quero que o campo de esforço só apareça quando o modelo escolhido realmente tem níveis.
7. Como usuário, quero que o subagente das etapas use o esforço que escolhi para o papel dele.

## Implementation Decisions

- O frontend é React com TypeScript. Os estilos são arquivos CSS do próprio projeto, sem framework de estilos.
- O backend do app é Tauri 2 com Rust. A recusa do quinto terminal fica do lado Rust, com mensagem de erro clara, e vale mesmo que a interface falhe.
- O limite de terminais simultâneos é quatro.
- Cada aba é um shell real e independente. Trocar de aba mantém o shell vivo; fechar a aba encerra só o shell dela.
- O campo de esforço é opcional por papel. A opção vazia significa usar o padrão do modelo escolhido.
- O campo de esforço só é mostrado para modelos que informam níveis de esforço. Ao trocar para um modelo sem níveis, o esforço escolhido é descartado, como já acontece no seletor do chat.
- O esforço do papel de subagente das etapas segue a mesma regra de exibição e de gravação dos outros papéis.
- Os nomes dos níveis de esforço são os mesmos da CLI, com a tradução para o nome mostrado ao usuário vinda do catálogo de modelos.
- Textos novos entram nos dicionários de português do Brasil e inglês.
- Testes automatizados usam Vitest no frontend e cargo test no backend.

## Testing Decisions

Os testes verificam só o comportamento externo: o que o usuário vê e o que o backend devolve.

- Abrir um segundo terminal mostra uma segunda aba com o seu próprio shell.
- Com quatro terminais abertos, o controle para abrir outro aparece desabilitado e explica o motivo.
- No backend, pedir um quinto terminal é recusado com mensagem clara, e os quatro existentes continuam funcionando.
- No orquestrador, o campo de esforço aparece para um modelo com níveis e não aparece para um modelo sem níveis.
- Trocar um papel de um modelo com níveis para um sem níveis faz o esforço escolhido desaparecer da tela.
- Um esforço escolhido para o subagente das etapas chega ao backend; sem escolha, nada é enviado para o esforço.
- Verificação manual: abrir dois terminais, trocar de aba sem perder o shell, fechar uma aba, tentar abrir o quinto; no orquestrador, escolher um modelo com níveis e outro sem níveis.

## Out of Scope

- Dividir terminais lado a lado na mesma área.
- Atalho de teclado para abrir terminal.
- Salvar as abas de terminal entre sessões do app.
- Alterar o catálogo de modelos e os níveis de esforço disponíveis.
- Alterar o seletor de esforço do composer do chat.
- Alterar o fluxo normal do turno do chat.
- Subagentes em segundo plano, que são outro trabalho.
- Publicação, push ou merge da branch.

## Further Notes

- O trabalho fica numa branch criada a partir da main.
- Cada terminal consome recursos do sistema como um shell comum. O limite de quatro existe para manter esse consumo previsível.
- Fechar o app encerra todos os shells abertos, como acontece hoje.
- A verificação manual depende do app rodando com o backend do Tauri.
