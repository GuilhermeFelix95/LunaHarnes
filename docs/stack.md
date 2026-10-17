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
- Etapa 3 (Tauri + UI de chat): comandos `send_prompt` e `cancel_prompt` (`src-tauri/src/commands.rs`), evento `provider-event`, `ChatView` com streaming e troca de provedor. Ícone provisório gerado em `src-tauri/icons`.
- Testes: `cargo test` (18) e `npx vitest run` (13). Build: `npx vite build`. A UI ainda não foi exercitada num `tauri dev` real.
- Etapa 4 (plugins): loader em Rust (`src-tauri/src/plugins/loader.rs`) com validação de manifesto e travessia bloqueada. Host em TS (`src/plugins/host.ts`) com permissões `commands` e `hooks`. Painéis (`registerPanel`) ficaram fora do MVP.
- Etapa 5: contrato em `docs/plugins.md` e plugin de referência em `plugins-examples/hello-world`.
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
- Testes:
  - `npm run test:rust`: 60 testes unitários, roda de qualquer terminal (o script carrega o MSVC).
  - `npm run test:smoke`: CLIs reais. Claude passa nos quatro casos. Codex é pulado enquanto não estiver logado.
  - `npm test`: 71 testes de frontend.
- CSP: `script-src 'self' blob:` é necessário para carregar plugins como módulo (ver `docs/plugins.md`, seção de segurança).
- Toolchain: Rust stable e MSVC Build Tools instalados. Rodar `cargo test` com `vcvars64.bat` carregado, senão o `link.exe` do Git é usado.
- Os CLIs são resolvidos pelo PATH, com `.cmd` e `.exe` no Windows. O prompt vai pelo stdin.
