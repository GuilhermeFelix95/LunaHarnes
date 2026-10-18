# Cache de respostas para economizar tokens

## Problem Statement

Perguntas repetidas dentro do LunaHarness gastam tokens a cada envio, mesmo quando a resposta já foi obtida antes no mesmo contexto. O usuário quer evitar essas chamadas repetidas ao provedor sem perder a confiança de que a resposta guardada ainda serve.

A API atual de plugins não permite pular um envio nem guardar respostas, então o recurso precisa de uma mudança pequena e pública na API de plugins.

## Solution

Um cache de respostas em memória, mantido pelo núcleo do app. Quando um pedido repetido chega, a resposta guardada aparece no chat marcada como vinda do cache, e o provedor não é chamado.

Um plugin oficial, chamado Cache de Tokens, liga e desliga o cache e oferece dois comandos: um para ver as estatísticas e outro para esvaziar o cache. Para isso, a API de plugins ganha uma nova permissão e um novo objeto de cache.

## User Stories

1. Como usuário, quero que uma pergunta repetida, no mesmo contexto, seja respondida sem nova chamada ao provedor, para economizar tokens.
2. Como usuário, quero ver claramente quando uma resposta veio do cache, para saber que não houve envio.
3. Como usuário, quero que o cache não devolva resposta velha ou errada quando o contexto mudou: outro agente, outro modelo, outra permissão, outro modo ou outra pasta.
4. Como usuário, quero que alterações de arquivos feitas pelo agente nunca sejam guardadas, porque a resposta depende do estado do projeto.
5. Como usuário, quero ligar e desligar o cache pelo plugin Cache de Tokens e consultar acertos com `/cache`.
6. Como usuário, quero esvaziar o cache com `/cache-limpar` quando quiser.
7. Como autor de plugins, quero declarar explicitamente a permissão de cache no manifesto, como já faço com commands, hooks e modes.
8. Como usuário, quero que um plugin que não pediu a permissão de cache não consiga mexer no cache.

## Implementation Decisions

- O cache fica no núcleo do app, em memória, durante a sessão. Não há gravação em disco.
- A API de plugins ganha uma nova permissão de cache e um objeto de cache com quatro operações: ligar ou desligar, esvaziar, consultar estatísticas e mostrar um aviso local. A operação de aviso existe porque comandos que devolvem texto são enviados ao provedor.
- Um pedido só usa o cache quando for a primeira mensagem da conversa. Com histórico, a mesma pergunta pode pedir resposta diferente.
- Um pedido não usa o cache quando traz anexos, imagens ou arquivos citados, porque a resposta depende deles.
- A chave do pedido inclui o texto final, o provedor, o perfil de API, o modelo, o esforço, a permissão, o modo, o modo de planejamento e a pasta do projeto.
- Só é guardada a resposta de um turno que terminou sem erro, dentro de um repositório git, e sem nenhuma alteração de arquivos no repositório. Em pasta que não é repositório, o cache não guarda nada, porque não há como confirmar que nenhum arquivo mudou.
- Ao trocar de pasta, o cache é esvaziado.
- A resposta devolvida pelo cache aparece com uma marca visível de que veio do cache.
- As estatísticas contam acertos e envios evitados. Não contam tokens economizados, porque o app não tem a contagem exata de tokens por turno no frontend.
- Os comandos do plugin de cache não devolvem texto para o provedor; mostram o resultado como aviso local.
- O plugin de exemplo fica na pasta de exemplos do repositório, como o plugin de modo Conversar. Não entra no catálogo oficial nesta entrega.
- A lista de permissões conhecidas, do lado Rust, passa a aceitar a nova permissão.
- A documentação da API de plugins e os tipos de exemplo descrevem a nova permissão e o novo objeto.

## Testing Decisions

Os testes verificam só comportamento externo: o que o usuário e o plugin observam.

- Um plugin sem a permissão de cache não consegue ligar, esvaziar, consultar ou avisar pelo cache, e a ativação é recusada com mensagem clara.
- Com o cache desligado, um pedido repetido sempre vai ao provedor.
- Com o cache ligado, a segunda vez que o mesmo pedido chega, no mesmo contexto, não chama o provedor e devolve a resposta guardada com a marca de cache.
- Pedidos com contexto diferente (agente, modelo, esforço, permissão, modo, pasta) não acertam o cache.
- Pedidos com histórico, com anexos, com arquivos citados ou no modo de planejamento não usam o cache.
- Um turno que alterou arquivos, ou que terminou com erro, não é guardado.
- Esvaziar o cache faz o próximo pedido repetido voltar ao provedor.
- As estatísticas refletem os acertos feitos na sessão.
- O aviso local aparece para o usuário e não é enviado ao provedor.
- A lista de permissões aceita a nova permissão e continua recusando permissões desconhecidas.
- Testes existentes que não tocam no cache não precisam ser reexecutados sem motivo.

## Out of Scope

- Persistência do cache entre sessões ou em disco.
- Contagem exata de tokens economizados.
- Cache de respostas com histórico da conversa.
- Cache para pedidos com anexos, imagens ou arquivos citados.
- Validade por tempo (TTL) e limite de tamanho.
- Cache por similaridade de significado.
- Publicação do plugin no catálogo oficial do marketplace.
- Detecção de alterações feitas por fora do app durante o turno, além das que o app já verifica.

## Further Notes

- Dentro de um repositório que já tem alterações não commitadas antes do turno, nenhuma resposta é guardada, porque a verificação enxerga essas alterações antigas. É a forma conservadora de não guardar respostas erradas.
- A mudança na API de plugins é pública: a documentação do guia de plugins, que também é usado pela Luna para criar plugins, precisa refletir a nova permissão e o novo objeto.
- A regra de não inventar APIs para plugins continua valendo para qualquer outra chamada além das documentadas aqui.
