# Taxa de acerto do cache de respostas

## Problem Statement

O plugin Cache de Tokens mostra quantos acertos houve e quantas respostas estão guardadas, mas não diz quão útil o cache está. Sem uma taxa, o usuário não sabe se o cache economiza envios ou se quase nunca acerta, por exemplo quando o projeto tem alterações não commitadas, que impedem de guardar respostas.

## Solution

O núcleo do cache passa a contar também as consultas feitas com o cache ligado. O plugin Cache de Tokens calcula a taxa de acerto como acertos divididos pelas consultas e mostra o resultado numa caixa fixa na barra lateral, além do comando /cache. Os contadores valem só para a sessão atual e voltam a zero ao reiniciar o app.

## User Stories

1. Como usuário, quero ver a taxa de acerto do cache na barra lateral, para saber se ele está ajudando.
2. Como usuário, quero que a taxa considere só os pedidos que de fato consultaram o cache, para não ser diluída por pedidos que nunca podiam usá-lo.
3. Como usuário, quero que o comando /cache mostre a mesma taxa, para conferir sem olhar a barra lateral.
4. Como usuário, quero que /cache-limpar esvazie as respostas guardadas sem apagar as estatísticas da sessão, para acompanhar o efeito da limpeza.
5. Como usuário, quero que a taxa comece do zero ao reiniciar o app, porque o cache também não persiste entre sessões.
6. Como usuário, quero ver um aviso claro quando não houve consultas ainda, em vez de um percentual enganoso.

## Implementation Decisions

- A taxa é acertos divididos por consultas ao cache. Uma consulta conta quando o cache está ligado e o pedido é elegível para o cache; pedidos não elegíveis não entram na conta.
- Com o cache desligado, nenhuma consulta é contada.
- Os contadores de acertos e de consultas ficam só em memória, na sessão. Não há gravação em disco.
- Esvaziar o cache remove as respostas guardadas, mas mantém os contadores da sessão.
- A taxa aparece em percentual com uma casa decimal, e quando não há consultas mostra um texto de espera, sem percentual.
- O plugin de exemplo usa a permissão de interface do próprio plugin para montar o bloco na barra lateral, que é o único ponto fixo disponível para isso. O painel direito continua sem ponto de montagem.
- O bloco da barra lateral é atualizado ao fim de cada resposta e depois de cada comando do plugin.
- O núcleo continua sendo o único dono do cache. O plugin só lê estatísticas e pede limpeza ou ligar e desligar.

## Testing Decisions

Os testes verificam só o comportamento externo: o que o usuário e o plugin observam.

- Com o cache ligado, um pedido que não encontra resposta guardada aumenta o total de consultas, sem aumentar acertos.
- Com o cache ligado, um pedido que encontra resposta aumenta acertos e consultas.
- Com o cache desligado, nenhuma consulta é contada.
- Esvaziar o cache não zera acertos nem consultas.
- Sem consultas, a taxa não aparece como percentual.
- A barra lateral mostra acertos, consultas e taxa do cache depois de uma resposta.
- O comando /cache mostra a mesma taxa que a barra lateral.
- /cache-limpar faz o próximo pedido repetido voltar ao provedor.

## Out of Scope

- Persistência das estatísticas entre sessões ou em disco.
- Contagem de tokens economizados.
- Ponto de montagem no painel direito; isso exige mudança no núcleo e fica para outra entrega.
- Alteração da cópia do plugin já instalada no computador do usuário; ela só muda ao reinstalar.
- Limite de tamanho e validade por tempo das respostas guardadas.

## Further Notes

- Em projetos com alterações não commitadas, o cache quase não guarda respostas. Com isso, a taxa tende a ficar baixa, e a barra lateral deve deixar essa causa visível ao usuário para não parecer defeito.
- A permissão de interface do plugin dá acesso à tela inteira. Quem instala o plugin precisa confiar no código, como já indica o guia de plugins.
- A spec de referência do cache continua em spec/cache-de-respostas.md; esta spec só cobre a taxa de acerto.
