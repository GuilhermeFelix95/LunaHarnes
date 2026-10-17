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
- CSP: `script-src 'self' blob:` é necessário para carregar plugins como módulo (ver `docs/plugins.md`, seção de segurança).
- Toolchain: Rust stable e MSVC Build Tools instalados. Rodar `cargo test` com `vcvars64.bat` carregado, senão o `link.exe` do Git é usado.
- Os CLIs são resolvidos pelo PATH, com `.cmd` e `.exe` no Windows. O prompt vai pelo stdin.
