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

- Etapa 1 do plano: repositório e documentação base.
- Pendente: toolchain Rust e MSVC Build Tools (necessários para `cargo check` e `tauri dev`).
