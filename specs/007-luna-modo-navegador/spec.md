# Spec: Luna do modo navegador, com esforço, histórico separado e instruções próprias

## Problem Statement

No modo navegador, o chat do agente usa as mesmas instruções da Luna do LunaCode. Essas instruções falam de plugins e de modos, que não têm nada a ver com navegar. Quando a pessoa pergunta o que a Luna pode fazer no navegador, a resposta sai com assuntos do LunaCode e nem sempre descreve o que o modo realmente faz.

O histórico também se mistura. As conversas do navegador somem do LunaCode, mas o modo navegador ainda lista as conversas do LunaCode. Quem usa os dois modos vê o que não é do modo atual.

Além disso, o cartão de escolha de IA do navegador não permite escolher o esforço do modelo, então o modo não pode usar o nível de raciocínio que a pessoa quer.

## Solution

O modo navegador passa a ter instruções próprias: a Luna explica o que o modo faz hoje, como resumir a página, explicar o conteúdo, preencher formulários e agir na página a pedido. Ela deixa claro que não gerencia favoritos nem histórico. As instruções do LunaCode não chegam a esse modo.

As conversas ficam separadas nos dois sentidos. O modo navegador lista só as suas conversas, e o LunaCode lista só as dele. Ao ligar o modo navegador com uma conversa do LunaCode aberta, o app abre uma conversa nova do navegador.

O cartão de IA do navegador ganha o seletor de esforço. Ele aparece só quando o modelo escolhido tem níveis de esforço, e o envio do navegador usa a escolha salva.

## User Stories

1. Como usuário, quero perguntar à Luna do navegador o que ela pode fazer e receber uma resposta sobre o modo navegador, sem assuntos de plugins.
2. Como usuário, quero que a Luna do navegador explique que pode resumir a página, explicar o conteúdo, preencher formulários e agir na página quando eu pedir.
3. Como usuário, quero que a Luna do navegador diga que não gerencia favoritos nem histórico, para não esperar isso dela.
4. Como usuário, quero que o modo navegador liste só as conversas do navegador, para não ver conversas do LunaCode nele.
5. Como usuário, quero que o LunaCode liste só as conversas do LunaCode, como já acontece.
6. Como usuário, quero que, ao ligar o modo navegador com uma conversa do LunaCode aberta, o app abra uma conversa nova do navegador, para não continuar a conversa errada.
7. Como usuário, quero escolher o esforço do modelo no cartão de IA do navegador, quando o modelo tiver esse recurso.
8. Como usuário, quero que o seletor de esforço não apareça quando o modelo não tem níveis, para não ver uma opção que não faz nada.
9. Como usuário, quero que o chat do navegador use o esforço que escolhi nas configurações.

## Implementation Decisions

- O modo navegador envia uma marca ao agente, e o agente escolhe as instruções pela marca. Sem a marca, as instruções são as do LunaCode, como hoje.
- As instruções do modo navegador descrevem só o que o modo faz hoje: resumir, explicar, preencher formulários, agir na página e buscar pelo motor escolhido. Favoritos e histórico não entram como capacidades.
- As instruções do modo navegador não incluem o guia de plugins nem as regras de modos do LunaCode.
- Os motores que hoje recebem instruções de sistema (Claude e Codex) recebem as do navegador no modo navegador. Os demais motores não mudam.
- A separação de conversas vale nos dois sentidos. Uma conversa pertence ao modo em que foi criada.
- A escolha de IA do navegador guarda motor, perfil, modelo e esforço. O esforço é opcional e vale só quando o modelo escolhido tem níveis.
- O envio do modo navegador usa a escolha salva. Sem escolha, segue a conversa atual, como antes.
- Os textos novos existem em português e em inglês.
- O modo navegador não mostra seletor de esforço nem de modelo no composer; a escolha fica nas configurações.

## Testing Decisions

Os testes verificam só o comportamento externo: o que a pessoa vê e o que o agente recebe.

- Uma conversa no modo navegador recebe as instruções do navegador, sem as do LunaCode.
- Uma conversa no LunaCode continua recebendo as instruções do LunaCode.
- As instruções do navegador dizem que a Luna pode resumir, explicar, preencher formulários e agir na página, e dizem que não gerencia favoritos nem histórico.
- O modo navegador lista só as conversas do navegador; o LunaCode lista só as suas.
- Ligar o modo navegador com uma conversa do LunaCode aberta abre uma conversa nova do navegador.
- O seletor de esforço aparece no cartão quando o modelo escolhido tem níveis, e não aparece quando não tem.
- O envio do modo navegador usa o modelo e o esforço escolhidos nas configurações.
- Sem escolha nas configurações, o envio do modo navegador segue a conversa atual.
- Os textos novos aparecem em português e em inglês.

## Out of Scope

- Novas ferramentas para o agente no navegador, como gerenciar favoritos ou histórico.
- Instruções próprias para os motores OpenCode e Antigravity.
- Migração das conversas já existentes para um dos modos.
- Garantia de que o modelo responde exatamente como descrito; os testes conferem o que é enviado ao agente.
- Mudança no composer do modo navegador, que continua sem seletor de esforço e de modelo.

## Further Notes

- As conversas que já existiam continuam no modo em que foram criadas.
- Quem usa os dois modos vai notar que a lista de cada modo ficou menor, porque cada um mostra só as próprias conversas.
- As instruções são uma orientação ao modelo, não uma garantia. A verificação manual deve conferir as respostas da Luna sobre favoritos e histórico.
