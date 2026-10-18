# Stack do LunaHarnes

Harness desktop leve que controla os CLIs oficiais do Claude Code e do Codex e aceita plugins criados pelo usuário.

## Tecnologias

| Camada | Tecnologia | Motivo |
|---|---|---|
| Shell desktop | Tauri 2 | Binário pequeno, usa o webview do sistema |
| Backend | Rust (Tauri commands) | Processos filhos, I/O e validação de plugins |
| Frontend | React + TypeScript + Vite | Produtividade e ecossistema |
| Testes frontend | Vitest + Testing Library | Testes rápidos no Node |
| Testes backend | `cargo test` | Parsers e adapters com fixtures |

## Arquitetura

- **Provider adapters:** um adapter por CLI traduz a saída JSON do CLI para eventos internos únicos (`MessageDelta`, `ToolUse`, `Done`, `Error`). O frontend nunca lê o formato bruto.
- **Integração:** subprocesso com saída JSON em streaming.
  - Claude Code: `claude -p --output-format stream-json`
  - Codex: `codex exec --json`
- **Plugins:** pasta com `manifest.json` e módulo JS/TS. A API exposta ao plugin é filtrada pelas permissões do manifesto. O manifesto é controle de API, não fronteira de segurança.

## Pastas

```
src/                 frontend React (chat, providers, host de plugins)
src-tauri/src/       backend Rust (providers, sessão, plugins, config)
plugins-examples/    plugins de referência
docs/                stack, contrato de plugins
```

## Regras do projeto

- Qualquer mudança é refletida neste arquivo e em `MEMORY.md`.
- Bugs começam com um teste que os reproduz.
- Testes focados: rodar só os testes dos módulos tocados, não a suíte completa, salvo pedido.
- Nunca criar, mover ou commitar keystores de assinatura Android.
- Commits sempre; push e merge só com aprovação explícita e testes passando.

## Estado atual

- Etapa 1 (repositório e documentação): concluída.
- Etapa 2 (providers e sessão em Rust): código e testes passando. Fixture de sucesso do Codex pendente (`codex login`).
- Etapa 3 (Tauri + UI de chat): comandos `send_prompt` e `cancel_prompt` (`src-tauri/src/commands.rs`), evento `provider-event`, `ChatView` com streaming e troca de provedor. Ícone da Luna (lua e órbita) em `src-tauri/icons`, gerado a partir de `src-tauri/icons/source.svg` com `npx tauri icon`. O `tauri.conf.json` declara os ícones do bundle, senão a janela usa o ícone padrão do Tauri.
- Testes: `cargo test` (18) e `npx vitest run` (13). Build: `npx vite build`. A UI ainda não foi exercitada num `tauri dev` real.
- Etapa 4 (plugins): loader em Rust (`src-tauri/src/plugins/loader.rs`) com validação de manifesto e travessia bloqueada. Host em TS (`src/plugins/host.ts`) com permissões `commands` e `hooks`. Painéis (`registerPanel`) ficaram fora do MVP.
- Etapa 5: contrato em `docs/plugins.md` e plugin de referência em `plugins-examples/hello-world`.
- Fase F, etapa 4 (marketplace): `src-tauri/src/plugins/marketplace.rs` (catálogo oficial embutido em `src-tauri/marketplace/official.json`, catálogos por URL https, sha256 obrigatório, instalação em pasta temporária). Permissão `modes` (`registerMode`, só `readOnly`) com chips no composer. Plugin oficial `plugins-examples/ask-mode` (modo Perguntar). Configurações > Plugins (Instalados e Marketplace). Crates novos: `sha2` e `reqwest` (rustls).
- Identidade: `LUNA_IDENTITY` (`src-tauri/src/providers/mod.rs`) vai em toda chamada. Claude: `--append-system-prompt` (acrescenta ao prompt padrão). Codex: `-c developer_instructions="..."`. Teste real com modelo não-Anthropic pendente.
- Perguntas do agente: bloco ```` ```luna-perguntas ```` com JSON (`src/chat/questions.ts`), protocolo em `QUESTION_PROTOCOL` (`src/chat/planning.ts`). Ao fim do turno o `ChatView` tira o bloco do chat e mostra o seletor `QuestionPicker` (`src/features/chat/QuestionPicker.tsx`). A escolha vai como próxima mensagem do mesmo turno.
- Login: a app verifica a conta de cada CLI (`check_auth`) e bloqueia o envio até ela estar conectada. O login interativo roda numa janela própria (`open_login`). Só Windows por enquanto.
- Comando `luna`: `bin/luna.mjs`, registrado com `npm link`. Abre o executável de release (`npm run build:app`).
- Fase B (interface e histórico):
  - Conversas em `<app_data>/conversations/<id>.json` (`src-tauri/src/conversations.rs`). Id só `[a-z0-9-]`.
  - Layout: `App.tsx` (barra lateral + chat). `ChatView` persiste a conversa ao fim de cada turno.
  - Componentes em `src/features/`: `chat/` (Composer, MessageList, Markdown), `sidebar/` (Sidebar, groupByDay), `auth/` (LoginPrompt).
  - Markdown: `react-markdown` + `remark-gfm`, sem `rehype-raw`. Links não navegam dentro do app.
  - Tema: tokens em `src/styles.css` (claro, escuro por sistema e por `data-theme`).
- Fase A (funcionamento):
  - Executável resolvido só com `.exe`, `.cmd` ou `.bat` no Windows (o script sem extensão instalado pelo npm dava erro 193).
  - Processos sem janela de console (`hidden_command`). stderr capturado; se o CLI sair sem `Done`, a app emite erro com o motivo.
  - `RunRequest` (provedor, prompt, `sessionId`, `cwd`, permissão) mapeado para os modos de cada CLI (`providers/claude.rs`, `providers/codex.rs`).
  - Streaming com `--include-partial-messages`; ferramentas viram `toolUse`.
  - Pasta de trabalho: `get_workspace` e seletor via `@tauri-apps/plugin-dialog`.
- Fase C (modelo, esforço, modo plano e projetos):
  - Modelo e esforço vêm da própria CLI (`src-tauri/src/models.rs`, comando `list_models`). Codex: `codex debug models` (fallback `--bundled`), só os modelos com `visibility: list`, com os níveis de cada modelo. Claude: aliases do `claude --help` (fable, opus, sonnet) e níveis low a max. Nomes completos do Claude não são listados.
  - Flags: Claude `--model`/`--effort`; Codex `-m` e `-c model_reasoning_effort="..."`. Valores passam por `RunRequest::validate` (sem começar com `-`, só `[A-Za-z0-9._-]`).
  - Modo plano (`src/chat/planning.ts`): instrução de planejamento no prompt, sandbox/permissão só leitura. Botão "Aprovar e executar" aparece após a resposta; a aprovação roda com a permissão escolhida no seletor.
  - Conversas guardam `model`, `effort` e `planning` (campos com `serde(default)`, arquivos antigos carregam).
  - Barra lateral agrupa por projeto (pasta) e, dentro de cada um, por dia. Botão "+" do projeto abre conversa nova naquela pasta; "+" no topo adiciona uma pasta.
- Fase D (catálogo, pasta, alterações, terminal e uso):
  - Catálogo de modelos do Claude copiado do seletor do Claude Desktop 2.42304.0 (`models.rs`): Opus 5.5, Sonnet 5.5, Haiku 5.5 e Fable 5.1, com descrição e níveis Low, Medium, High, Extra (`xhigh`) e Max. O recomendado vem marcado. Quando sair modelo novo, copiar de novo do Desktop.
  - Seletor de modelo com nome e descrição (`ModelMenu.tsx`). A pasta de trabalho saiu do topo e fica no rodapé (`WorkspaceChip.tsx`), com recentes.
  - Barra lateral com busca por título (`Sidebar.tsx`, `filterByTitle`).
  - Painel de alterações à direita (`changes.rs`, `ChangesPanel.tsx`): `git status --porcelain -z` e `git diff --numstat -z`, com diff por arquivo. Fora de git, mostra aviso.
  - Terminal embaixo da coluna do chat (`terminal.rs`, `TerminalPanel.tsx`): PowerShell num PTY (`portable-pty` 0.9, ConPTY), com `@xterm/xterm` 6.0.0 e `@xterm/addon-fit` 0.11.0. Ctrl+` alterna. Trocar a pasta reinicia o terminal (`key={cwd}`).
  - Uso da conta e contexto (só Claude): evento `rate_limit_event` (janelas `five_hour` e `seven_day`, `utilization` e `resetsAt`) e `result.modelUsage` (tamanho da janela). Fixture real: `tests/fixtures/claude_usage.jsonl`. O medidor (`UsageMeter.tsx`) mostra no rodapé.
  - Pendente de confirmação: se `utilization` é fração de 0 a 1. A captura mostra 0.45 e 0.35; falta comparar com o número do Claude Desktop.
  - O seletor de modelo não tem mais "Padrão da CLI": sem escolha, usa o primeiro modelo da lista (`ChatView.tsx`). O esforço ainda tem "Padrão".
  - Teste E2E com `luna` numa pasta git de teste: terminal, painel de alterações, medidor de uso e modo plano com aprovação funcionaram. Smoke do Claude passou nos quatro casos.
- Fase E (troca de agente, painel direito, temas e rolagem):
  - Troca de agente no meio da conversa (`src/chat/handoff.ts`). Cada agente guarda a própria sessão e quantas mensagens já viu (`sessions` na conversa; arquivos antigos usam `sessionId`). Ao trocar, o agente recebe o histórico em texto original (ou só o que perdeu) e o estado do git, sem resumo por modelo. Acima de 120 mil caracteres, só respostas antigas do agente são cortadas.
  - Respostas agrupadas (`MessageList.tsx`): o nome do agente aparece uma vez por resposta e as ferramentas seguidas viram uma linha recolhível com a contagem.
  - Rolagem que segue o fim da resposta (`src/chat/useStickToBottom.ts`). Ao rolar para cima, para onde o usuário está e aparece "Ir para o fim".
  - Painel direito com abas Alterações e Terminal e largura ajustável pela alça (`src/features/side/RightPanel.tsx`). Largura entre 240 px e 60% da janela, salva em `luna.rightPanel.width`. O terminal fica montado ao trocar de aba.
  - Configurações (`SettingsView.tsx`) com temas: Sistema, Claro, Escuro, Luna, Aurora, Duna e Grafite (`src/theme.ts`, cores em `styles.css`). A escolha fica em `luna.theme` e é aplicada em `main.tsx` antes do primeiro render.
  - Pendente: o fundo do terminal ainda é preto fixo (não segue o tema). Troca Claude → Codex ainda não testada ponta a ponta, porque o Codex não está logado.
- Fase F (em andamento):
  - Etapa 1 (ajustes): ícone novo; modelo padrão é o mais barato (Haiku 5.5 no Claude; `gpt-6-luna` no Codex, pela família "luna"/"mini"/"nano"), marcado com `default` em `models.rs`; clicar de novo num arquivo de Alterações fecha o diff; contexto e uso em k/M (`formatTokens`: "44k", "1,2M").
  - Etapa 2 (visual "Vidro lunar"): tokens `--glass`, `--glass-border`, `--glow`, `--shadow` e `--radius-lg` em `src/styles.css` (o `--glow` muda por tema; o vidro é `color-mix` sobre `--surface`). Fundo com brilho radial do tema; barra lateral, painel e composer com `backdrop-filter`. Fonte Inter Variable (`@fontsource-variable/inter`, offline) importada em `main.tsx`. Ícones `lucide-react` 1.50.0 nos botões do composer, cabeçalho e barra lateral. Logo `src/assets/luna.svg` no topo da barra e na tela vazia, com sugestões que preenchem a caixa sem enviar. Avatar do agente (`PROVIDER_ICONS`) em cada resposta e ferramentas como chip. Terminal usa `--terminal-bg`/`--terminal-fg` e reage a `luna:theme`.
  - Etapa 3 (modelos via API): perfis em `src-tauri/src/api_profiles.rs`, salvos em `<app_data>/api-profiles.json` sem segredo. A chave vai para o Gerenciador de Credenciais do Windows (crate `keyring` 4.2.0, usuário `profile:<id>`) e nunca volta para a interface nem entra no `RunRequest`. Presets: Anthropic (chave), OpenRouter, DeepSeek, Z.ai (GLM, com `API_TIMEOUT_MS`), OpenCode Zen e personalizado compatível com Anthropic (motor Claude Code, `ANTHROPIC_AUTH_TOKEN` ou `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`); OpenAI (chave, motor Codex, `OPENAI_API_KEY`). O motor Claude com perfil roda com `CLAUDE_CONFIG_DIR=<app_data>/claude-api/<id>`, para o login do claude.ai não passar por cima da chave. Variáveis só no processo do CLI (`Session::start_with_env`). Endereço: https, ou http só para localhost. Modelo aceita `/` e `:` (slugs de agregador). O seletor de Provedor virou seletor de agente (`claude`, `codex`, `api:<id>`, em `src/chat/agents.ts`); as respostas levam o nome do perfil e a conversa guarda `profile` e `costUsd`. Evento `cost` vindo de `total_cost_usd` da CLI. Configurações → Contas e APIs: login das CLIs, lista de perfis, formulário (chave em campo de senha), Testar conexão (prompt mínimo pelo perfil). Ainda fora desta etapa: presets Moonshot/Kimi e OpenAI-compatível personalizado no Codex (`model_providers`), e a busca automática da lista de modelos (`GET /v1/models`), que hoje é digitada no perfil.
- Testes:
  - `npm run test:rust`: 79 testes unitários (mais 1 ignorado, o teste do cofre real: `npm run test:rust -- --lib api_profiles::tests::keyring -- --ignored`), roda de qualquer terminal (o script carrega o MSVC).
  - `npm run test:smoke`: CLIs reais. Claude passa nos quatro casos. Codex é pulado enquanto não estiver logado.
  - `npm test`: 105 testes de frontend na última suíte completa (Etapa 1). A Etapa 3 acrescentou 10 (configurações, agentes, ChatView, composer, mensagens, reducer e handoff); só esses rodaram.
- CSP: `script-src 'self' blob:` é necessário para carregar plugins como módulo (ver `docs/plugins.md`, seção de segurança).
- Toolchain: Rust stable e MSVC Build Tools instalados. Rodar `cargo test` com `vcvars64.bat` carregado, senão o `link.exe` do Git é usado.
- Os CLIs são resolvidos pelo PATH, com `.cmd` e `.exe` no Windows. O prompt vai pelo stdin.
- Fase F, etapa 5 (recursos de MVP): paralelismo (uma execução por conversa, `ActiveRuns` no Rust, eventos `{ runId, event }`, abas do chat montadas e indicador na barra lateral); desfazer por arquivo (`changes::discard`); checkpoint por turno com índice temporário (`src-tauri/src/checkpoints.rs`, sem commit) e "Voltar até aqui" com confirmação; @arquivo (`list_files`, rastreados e não ignorados) no composer; imagens (PNG, JPEG, WebP até 10 MB, salvas em `<app_data>/attachments`; Claude recebe stream-json com bloco de imagem, Codex recebe `-i`); avisos do sistema com `tauri-plugin-notification` 2.5.1 quando a janela não está em foco. Fora desta etapa: worktree por conversa.
- Rodada de ajustes (2026-10-17): ícone corrigido com `img-src data:` na CSP; barra lateral redimensionável (`luna.sidebar.width`); rolagem do chat fina e centralizada; Configurações em abas (Geral, Modelos e APIs, Plugins); conversa nova começa na entrevista (modo plano, botão "Pular entrevista"); plano completo na aba "Plano" do painel direito, salvo na conversa (`plan` em `conversations.rs`); "Gerar spec" com as sete seções do to-spec (`SPEC_INSTRUCTION` em `src/chat/planning.ts`); presets de API com modelos sugeridos e modelo padrão, para só colar a chave (estilo OpenCode).
- Catálogo de APIs (2026-10-17): presets trazem modelos prontos e modelo padrão (o mais barato); Moonshot/Kimi entra no catálogo; OpenCode Zen usa `https://opencode.ai/inference/anthropic` e só os modelos de `/v1/messages`; botão "Atualizar lista de modelos" chama `refresh_api_models` (GET `<base>/v1/models`, timeout 10 s, chave só no cabeçalho). Escolha do provedor em cartões (`role="radio"`), com a lista de modelos preenchida ao escolher.
