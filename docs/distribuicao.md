# Distribuição

Checklist para publicar o LunaHarness. Cada item diz o que já está pronto e o que depende de ação do autor.

## Já pronto

- [x] Licença **Apache-2.0** em `LICENSE`, com aviso em `NOTICE`.
- [x] Documento de privacidade em `docs/privacidade.md`.
- [x] Aviso de que o app não é afiliado à Anthropic nem à OpenAI (`NOTICE`).
- [x] README com instalação e requisitos.

## Depende do autor

- [x] **Chave do atualizador:** nova chave gerada em 2026-10-19 (a anterior foi perdida; nada tinha sido publicado). Privada em `%USERPROFILE%.tauriluna-updater.key`, fora do repositório, com `TAURI_SIGNING_PRIVATE_KEY` apontando para ela. Pública já trocada em `tauri.conf.json`. Falta fazer cópia de segurança da privada e publicar a release assinada.
- [ ] **Repositório público:** antes de mudar a visibilidade, varrer o histórico atrás de segredos (tokens, chaves, `.env`, keystores) e mostrar o resultado ao autor. A mudança só acontece com autorização explícita.
- [ ] **Assinatura de código:** pedir a SignPath Foundation (gratuito para código aberto). Até a aprovação, o instalador sai sem assinatura, e o Windows mostra o aviso do SmartScreen. Isso deve ser dito no README.

## Antes de divulgar

Bloqueios para anunciar uma versão estável. Os itens marcados com (autor) dependem de ação sua.

- [x] (autor) Publicar a release 0.1.0 (pré-release, tag `v0.1.0`) com `.exe`, `.sig` e `latest.json` (feito em 2026-10-19).
- [ ] (autor) Publicar a 0.1.1 como release normal (latest): pré-release não entra no endereço `releases/latest` que o atualizador consulta.
- [x] Enviar os commits locais ao GitHub (feito: `9ea03ee` em `origin/main`).
- [ ] (autor) Testar atualização 0.1.0 → 0.1.1 de ponta a ponta: o aviso ao abrir aparece e a instalação funciona.
- [ ] (autor) Rodar o app num `npm run dev:app` real: navegador, mascote, Progresso e tema Game Boy.
- [ ] Assinatura de código (SignPath) quando aprovada; até lá o README avisa do SmartScreen.

## Termos e marca

- O nome do app é **LunaHarness**. Não use "Claude" nem o logo da Anthropic no nome, no ícone ou em destaque na tela.
- O app depende dos CLIs oficiais já instalados pelo usuário (`claude` e `codex`), que seguem os termos de uso de cada provedor. O app não contorna limites de uso nem de assinatura.
- Cada CLI muda com o tempo. Quando um CLI mudar a saída que o app lê, o app pode precisar de ajuste.

## Requisitos de execução

- Windows 10 versão 1809 ou mais nova, ou Windows 11.
- Pelo menos um CLI instalado e com login feito.
- Sem Node.js nem Rust para quem só usa o app.

## Atualizações

- Feito: o atualizador lê `latest.json` nas releases do repositório público, e Configurações > Sobre procura e instala sob pedido.
- Feito: antes de instalar, o app encerra execuções e terminais em andamento.
- Falta: checagem automática ao abrir o app, e a primeira atualização real de ponta a ponta (versão 0.1.0 instalada, depois 0.1.1 de teste).
- Depende do autor: a chave privada (`TAURI_SIGNING_PRIVATE_KEY`) para o `npm run release:app`. Sem ela o build não gera o `.sig`.

## Passos para um release

1. Ajustar a versão no `package.json`, no `Cargo.toml` e no `tauri.conf.json`.
2. Rodar os testes dos módulos alterados.
3. Gerar o instalador assinado pelo atualizador e o `latest.json`.
4. Criar a tag `v<versão>` e publicar o release com os arquivos gerados.
5. Pedir a assinatura de código à SignPath, quando ela estiver aprovada.

Os passos 3 a 5 ainda não estão automatizados. O workflow de release só roda por tag ou por pedido explícito, para não gastar minutos de Actions sem necessidade.
