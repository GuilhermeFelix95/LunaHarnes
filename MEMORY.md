# MEMORY — LunaHarnes

Formato: `AAAA-MM-DD | o que mudou` (ordem cronológica, linhas antigas nunca são reescritas).

2026-10-17 | Projeto criado com plano aprovado: Tauri 2 + React/TS, integração por subprocesso (claude stream-json / codex --json), plugins por manifesto + JS/TS, MVP de chat único com troca de provedor.
2026-10-17 | Repositório Git iniciado, `.gitignore` e `docs/stack.md` criados.
2026-10-17 | Rust (rustup, stable) e MSVC Build Tools instalados. `cargo test` só roda com o ambiente do MSVC carregado (vcvars64).
2026-10-17 | Núcleo de providers em `src-tauri/src/providers` (parsers Claude stream-json e Codex JSONL) e `session.rs` (spawn, pump, cancel, resolução de .cmd no Windows). 9 testes passando. Fixture de sucesso do Codex pendente (exige `codex login`).
