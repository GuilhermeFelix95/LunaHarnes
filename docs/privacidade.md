# Privacidade

Este documento descreve o que o LunaHarness faz com os seus dados. Ele vale para a versão atual do app.

## Resumo

- O app **não tem telemetria**: não envia relatórios de uso, estatísticas nem identificadores para o autor.
- As conversas são **guardadas só no seu computador**, na pasta de dados do app.
- Quando você conversa com o Claude ou com o Codex, o conteúdo segue **diretamente do CLI oficial para o provedor** (Anthropic ou OpenAI), sob as políticas deles. O app não é intermediário desse envio.
- Chaves de API ficam no **Gerenciador de Credenciais do Windows**. O app nunca mostra o valor depois de salvo.
- Logins do Claude Code e do Codex são feitos pelos CLIs oficiais. O app não lê nem guarda essas credenciais.

## O que fica no seu computador

| Dado | Onde | Observação |
|---|---|---|
| Conversas | Pasta de dados do app | Texto das mensagens e os resultados das ferramentas. |
| Anexos | Pasta de anexos do app | Imagens e arquivos que você anexou. |
| Chaves de API | Gerenciador de Credenciais do Windows | Só quando você usa perfil com chave de API. |
| Plugins e skills | Pasta de plugins do app e configuração global de cada CLI | Os plugins instalados ficam aqui. |
| Configurações | Armazenamento local do app | Tema, idioma, preferências. |

## O que sai do seu computador

- **Prompts e respostas:** vão para o provedor escolhido (Claude ou Codex), pelo CLI oficial. Consulte a política de privacidade de cada um.
- **Página do navegador integrado:** quando você ou o agente abre um endereço, o próprio navegador (a webview do Windows) acessa o site. O app não envia o conteúdo dessas páginas a ninguém, mas o agente lê o texto da página para responder, e esse texto segue para o provedor como parte da conversa.
- **Atualizações:** quando a atualização automática estiver disponível, o app consulta o endereço de releases do repositório público para saber se há versão nova. Essa consulta não identifica você.

## Plugins

Plugins rodam com acesso amplo à interface e ao conteúdo das conversas, conforme a permissão que pedem no manifesto. Instale apenas plugins de quem você confia. A tela de instalação mostra as permissões antes de você confirmar.

## Registro de erros

Hoje os erros vão para a saída do terminal que iniciou o app. Eles não são enviados a lugar nenhum. Um registro em arquivo ainda não existe; quando existir, este documento será atualizado.

## Seus direitos e controle

- Você apaga as conversas pelo próprio app.
- Você remove chaves de API pela tela de perfis.
- Desinstalar o app não apaga as conversas nem as chaves: elas ficam na pasta de dados e no Gerenciador de Credenciais até você removê-las.
