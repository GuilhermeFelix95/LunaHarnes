# Distribuição

Checklist para publicar o LunaHarness. Cada item diz o que já está pronto e o que depende de ação do autor.

## Já pronto

- [x] Licença **Apache-2.0** em `LICENSE`, com aviso em `NOTICE`.
- [x] Documento de privacidade em `docs/privacidade.md`.
- [x] Aviso de que o app não é afiliado à Anthropic nem à OpenAI (`NOTICE`).
- [x] README com instalação e requisitos.

## Depende do autor

- [ ] **Chave do atualizador:** gerar com `npx tauri signer generate`. A chave privada fica fora do repositório, com cópia de segurança. Sem ela não há release assinado para o atualizador. Perder a chave impede atualizações para quem já instalou.
- [ ] **Repositório público:** antes de mudar a visibilidade, varrer o histórico atrás de segredos (tokens, chaves, `.env`, keystores) e mostrar o resultado ao autor. A mudança só acontece com autorização explícita.
- [ ] **Assinatura de código:** pedir a SignPath Foundation (gratuito para código aberto). Até a aprovação, o instalador sai sem assinatura, e o Windows mostra o aviso do SmartScreen. Isso deve ser dito no README.

## Termos e marca

- O nome do app é **LunaHarness**. Não use "Claude" nem o logo da Anthropic no nome, no ícone ou em destaque na tela.
- O app depende dos CLIs oficiais já instalados pelo usuário (`claude` e `codex`), que seguem os termos de uso de cada provedor. O app não contorna limites de uso nem de assinatura.
- Cada CLI muda com o tempo. Quando um CLI mudar a saída que o app lê, o app pode precisar de ajuste.

## Requisitos de execução

- Windows 10 versão 1809 ou mais nova, ou Windows 11.
- Pelo menos um CLI instalado e com login feito.
- Sem Node.js nem Rust para quem só usa o app.

## Atualizações (planejado, ainda não implementado)

- O atualizador usa o endereço `latest.json` nas releases do repositório público.
- Antes de instalar uma atualização, o app encerra execuções e terminais em andamento.

## Passos para um release

1. Ajustar a versão no `package.json`, no `Cargo.toml` e no `tauri.conf.json`.
2. Rodar os testes dos módulos alterados.
3. Gerar o instalador assinado pelo atualizador e o `latest.json`.
4. Criar a tag `v<versão>` e publicar o release com os arquivos gerados.
5. Pedir a assinatura de código à SignPath, quando ela estiver aprovada.

Os passos 3 a 5 ainda não estão automatizados. O workflow de release só roda por tag ou por pedido explícito, para não gastar minutos de Actions sem necessidade.
