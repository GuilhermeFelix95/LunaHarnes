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
- Testes:
  - `npm run test:rust`: 33 testes, roda de qualquer terminal (o script carrega o MSVC).
  - `npm run test:smoke`: CLIs reais. Claude passa nos quatro casos. Codex é pulado enquanto não estiver logado.
  - `npm test`: 18 testes de frontend.
- CSP: `script-src 'self' blob:` é necessário para carregar plugins como módulo (ver `docs/plugins.md`, seção de segurança).
- Toolchain: Rust stable e MSVC Build Tools instalados. Rodar `cargo test` com `vcvars64.bat` carregado, senão o `link.exe` do Git é usado.
- Os CLIs são resolvidos pelo PATH, com `.cmd` e `.exe` no Windows. O prompt vai pelo stdin.
