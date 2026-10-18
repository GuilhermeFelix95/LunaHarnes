# Cache de prompt

O custo que o Luna pode reduzir está no **cache de prefixo do provedor**: a Anthropic e a OpenAI reaproveitam o começo do pedido já visto e cobram menos por esses tokens. O Luna não guarda respostas. O cache de respostas que existia antes foi removido, porque devolvia uma resposta antiga sem consultar o provedor.

## Como o acerto se mede

Taxa de acerto de um turno = `lidos / (lidos + gravados + novos)`, em tokens de entrada.

- **lidos**: tokens reaproveitados do cache (`cache_read_input_tokens` no Claude; `cached_input_tokens` no Codex).
- **gravados**: tokens escritos no cache neste turno (`cache_creation_input_tokens`; no Codex o app não recebe esse campo, então é nulo).
- **novos**: tokens sem cache (`input_tokens`, sem os lidos no Codex).

Campo que o provedor não informa é `null`, nunca zero. Sem leitura não há taxa e o painel mostra "sem dados".

## Núcleo

- `providers/mod.rs`: `ProviderEvent::CacheUsage { fresh, read, write }`, emitido uma vez por turno, antes de `done`.
- `providers/claude.rs`: lê o `usage` do evento `result`.
- `providers/codex.rs`: lê o `usage` do `turn.completed`.
- `src/chat/promptCache.ts`: `hitRate`, `aggregateRate`, `diagnose` e `summarize`. Função pura, sem efeito colateral.
- `ChatView.tsx`: registra cada turno medido no livro da conversa e atualiza o resumo do host (`host.setCacheSummary`). Trocar de pasta zera o livro.

## Diagnóstico

Quando o acerto de um turno fica abaixo de 50%, o motivo sai nesta ordem:

1. `aquecendo`: primeiro turno da sessão, o cache ainda não tinha o que ler.
2. `sessao-nova`: a sessão mudou.
3. `modelo-trocado`: cada modelo tem o próprio cache.
4. `prompt-mudou`: o prompt de sistema (identidade, modelo, esforço, janela) mudou.
5. `pausa`: passou mais tempo que o TTL do cache.
6. `desconhecido`.

## TTL e cache de 1 h

- Claude: 5 min por padrão. Com **Configurações > Conversa > Cache longo (1 h)**, o app põe `ENABLE_PROMPT_CACHING_1H=1` no ambiente, só para perfil de chave da Anthropic (`api_profiles::long_cache_env`). A escrita custa mais; a leitura custa menos. Desligado por padrão.
- Codex: o app não recebe o tempo de vida do cache, então o estado é `sem-ttl`.
- Dica: com duas pausas que apagam o cache numa conversa, e sem o cache de 1 h ligado, o resumo sugere ligá-lo.

## Plugin Cache de Tokens v1.0

`plugins-examples/cache-tokens/`, instalado por padrão do catálogo oficial (`src-tauri/marketplace/official.json`, com sha256). O módulo `plugins/seed.rs` instala uma vez, na abertura do app, e grava um marcador em `<app_data>/plugins-seeded/`. Se a pessoa desinstalar, o marcador impede a volta. Uma versão antiga instalada é trocada pela atual.

A API do plugin é só leitura (`api.cache.stats()` e `api.cache.notify()`), ver `docs/plugins.md`.

## Limitações conhecidas

- Com várias conversas abertas, o painel mostra o resumo da conversa que ocupa a barra lateral. Um bloco por plugin: a conversa que montou primeiro é a dona, e a outra assume só quando ela fecha.
- A janela de contexto entra na identidade do prompt. Se a lista de modelos chegar depois do primeiro turno, o prompt de sistema muda e o cache erra. Pendente: fixar a janela por conversa.
- Números de acerto reais dependem da execução com o provedor. Os testes cobrem a lógica, não o provedor.
