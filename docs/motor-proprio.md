# Motor próprio: viabilidade e regras

Estudo, sem código. Pergunta: dá para o LunaHarness ter um motor próprio, que não seja a CLI do Claude Code nem a do Codex, e isso pode usar a assinatura do usuário?

## Resposta curta

- **Tecnicamente, sim.** Um motor é um laço: o modelo responde, pede ferramentas (ler arquivo, editar, buscar, rodar comando), o host executa com permissão e devolve o resultado, e a conversa segue com gestão de contexto.
- **Com a assinatura Claude Pro/Max num motor próprio, não.** As regras da Anthropic proíbem.
- **Com a assinatura ChatGPT/Codex num motor próprio, ainda não está claro.** A OpenAI tem um caminho para apps de terceiros, mas ele depende de registro e aprovação.
- **O que é permitido hoje:** orquestrar as CLIs oficiais (Claude Code e Codex) com o login que o próprio usuário fez nelas, que é o que o LunaHarness já faz. E um motor próprio com **chave de API**, cobrada de quem é dono da chave.

## Claude: o que as regras dizem

Fonte: Claude Code, Legal and Compliance (code.claude.com/docs/en/legal-and-compliance).

- Tokens OAuth de planos Free, Pro e Max são para o Claude Code e para os apps nativos da Anthropic.
- Desenvolvedores que criam produtos devem usar chave de API.
- Terceiros não podem oferecer login com Claude.ai nem rotear pedidos com credenciais de plano ("route requests through Free, Pro, or Max plan credentials").
- É permitido o usuário fazer login no binário oficial, sem modificação, com a própria assinatura.

Leitura prática: um motor próprio que receba o token do plano, ou que chame a API com ele, está fora. Um app que apenas inicia o `claude` oficial e deixa o login com o próprio binário está dentro.

## OpenAI / Codex: o que as fontes dizem

Fontes: developers.openai.com (Codex auth e "Sign in with ChatGPT").

- Orquestrar o Codex CLI com o login do usuário é o uso previsto.
- "Sign in with ChatGPT" para apps de terceiros está descrito como disponível para "all open-source partners and selected private clients", com client ID registrado. Não há confirmação de que um motor próprio do LunaHarness se encaixe. Isso precisa de resposta da OpenAI antes de qualquer implementação.

## Como o Paseo faz

Paseo não tem motor próprio. É um daemon local que roda as CLIs que já estão instaladas (Claude Code, Codex, OpenCode, Pi), usando as credenciais que o usuário já tem nelas. O diferencial dele está em worktrees, acesso pelo celular, relay criptografado e plugins. É o mesmo modelo que o LunaHarness usa hoje, então não há nada ali que permita usar o token do plano num motor próprio.

## Recomendação: modelo híbrido

1. **Assinaturas continuam pelas CLIs oficiais.** Claude Code e Codex, com o login do próprio usuário, sem modificar o binário.
2. **Motor "Luna" próprio, só para perfis de API.** OpenRouter, DeepSeek, Anthropic API e OpenAI API, com chave do usuário. Não toca em nenhuma assinatura.
3. **Antes de começar o motor, decidir:** permissões de ferramentas (leitura livre, escrita e comando com confirmação), contexto (resumo ao passar do limite) e o que muda na aba Progresso, que hoje depende dos eventos do Claude e do Codex.

## Etapas se o motor for feito

1. Cliente de API com streaming para um perfil de API já cadastrado, sem ferramentas. Verifica resposta e custo.
2. Ferramentas de leitura (listar, ler, buscar), dentro da pasta de trabalho, sem pedir permissão.
3. Ferramentas de escrita e comando, com a mesma confirmação que o composer já tem.
4. Histórico e contexto: cortar e resumir ao passar do limite do modelo.
5. Testes com um perfil de teste, antes de liberar para o usuário.

## Pontos em aberto

- Resposta da OpenAI sobre o "Sign in with ChatGPT" para um app próprio. Sem ela, o motor próprio só funciona com chave de API.
- Não há nada aqui que mude código. As regras acima devem ser relidas antes de qualquer implementação, porque as páginas podem mudar.
