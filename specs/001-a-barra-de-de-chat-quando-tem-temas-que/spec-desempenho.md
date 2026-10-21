# Desempenho das animações e da resposta do chat

## Problem Statement

O app trava quando há animações e durante a resposta do agente. As animações são parte da identidade visual e devem continuar, mas hoje a tela perde quadros: a resposta refaz a conversa inteira a cada pedaço de texto, o desfoque de fundo fica ligado em áreas grandes que estão sempre sobre conteúdo que muda, algumas transições mudam a largura de elementos a cada quadro, e as durações são longas, o que dá a sensação de lentidão.

## Solution

Manter as animações, mas tornar o custo delas e o da resposta baixos. A resposta chega sem refazer a tela a cada pedaço: a tela é atualizada no máximo uma vez por quadro, e a conversa só repinta as mensagens que mudaram. As animações passam a mover apenas posição e opacidade, sem mudar largura nem tamanho a cada quadro. O efeito de vidro com desfoque fica só nas camadas opcionais do tema. As durações base ficam mais curtas, para o app responder com agilidade sem perder a suavidade.

## User Stories

1. Como usuário, quero rolar e ler a resposta enquanto ela chega, sem a tela travar.
2. Como usuário, quero que as mensagens antigas da conversa não mudem nem piscem quando chega texto novo.
3. Como usuário, quero que o texto da resposta apareça completo assim que o agente termina, sem atraso.
4. Como usuário, quero que as animações continuem presentes, mas sejam rápidas e não atrasem minhas ações.
5. Como usuário que prefere menos movimento, quero que todas as transições do app sejam imediatas.
6. Como usuário, quero abrir e fechar o modo navegador e o painel direito sem travamento.
7. Como usuário, quero que a aparência continue coerente com o tema escolhido, mesmo sem o efeito de vidro nos painéis.

## Implementation Decisions

- O frontend é React com TypeScript. Os estilos são CSS próprio do projeto, sem biblioteca de animação.
- As cores e o raio vêm dos tokens do tema. Duração e curva de movimento vêm dos tokens globais; nada de tempo fixo em componente.
- O movimento usa só propriedades que o navegador compõe sem recalcular o layout: posição, escala e opacidade. Largura, altura e sombra não animam.
- A conversa é atualizada no máximo uma vez por quadro de tela enquanto a resposta chega. A referência com o conteúdo atual é sempre a mais recente; o que muda é o momento em que a tela é redesenhada.
- Ao fim da resposta, a tela é atualizada imediatamente com o texto completo.
- Cada mensagem é renderizada de forma independente: uma mensagem que não mudou não é processada de novo.
- O efeito de vidro com desfoque não fica ligado nas áreas grandes do layout (barra lateral, painel direito, composer e cartões de sugestão). Ele continua disponível apenas no modo de vidro opcional do tema, e nos diálogos e telas de primeira abertura.
- As durações base são 200 ms no padrão e 140 ms nas curtas. Movimentos de modo (navegador) e de transição de tela usam múltiplos dessas durações, com multiplicadores menores que os atuais.
- Com movimento reduzido, as durações e as repetições de animação são zeradas, como já é o comportamento global.
- Os testes automatizados usam Vitest, e o tipo do projeto é verificado com o compilador TypeScript sem erros.

## Testing Decisions

Os testes verificam só o comportamento externo: o que o usuário vê e o que o app entrega.

- Quando vários pedaços da resposta chegam dentro do mesmo quadro, o texto final aparece completo e na ordem certa.
- Ao terminar a resposta, o texto completo aparece na hora, sem esperar o próximo quadro.
- Quando só a última mensagem muda, as mensagens anteriores continuam com o mesmo conteúdo na tela.
- Painéis grandes não mostram desfoque de fundo no tema padrão.
- Os tempos de transição e de animação do tema são curtos, e com movimento reduzido ficam zerados.
- O modo navegador e o painel direito abrem e fecham sem alterar a largura do chat por animação.

## Out of Scope

- Trocar a biblioteca de interface ou a forma como o app é empacotado.
- Otimizar o backend Rust: o gargalo medido está no frontend.
- Remover o efeito de vidro dos temas que o escolheram de forma explícita (modo de vidro opcional).
- Alterar o indicador das Configurações e o subagente em segundo plano, que são outro trabalho.
- Medição automática de quadros no app. A medição fica como verificação manual.
- Publicação, push ou merge das branches.

## Further Notes

- O trabalho parte da branch que já tem a correção do campo de digitação, para não repetir a mudança.
- A verificação manual é feita pela pessoa usuária com o app em modo de desenvolvimento: pedir uma resposta longa e rolar durante ela, abrir e fechar o modo navegador, e trocar de seção nas Configurações. O painel de desempenho do navegador (F12) mostra quadros acima de 16 ms.
- Como o efeito de vidro sai das áreas grandes, o visual muda um pouco nos temas com vidro. Essa troca é aceita pela pessoa usuária.
