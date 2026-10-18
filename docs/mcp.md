# Servidores MCP

Servidores MCP dão ferramentas extras ao agente, como memória ou acesso ao GitHub. O LunaHarness grava os servidores nas configurações globais das duas CLIs, então eles valem para o Claude Code e para o Codex, em todas as conversas e no terminal.

## Onde ficam

- **Claude Code**: chave `mcpServers` em `~/.claude.json`. As outras chaves do arquivo são preservadas.
- **Codex**: tabelas `[mcp_servers.<nome>]` em `~/.codex/config.toml`, editadas com `toml_edit`, então comentários e a ordem do arquivo são mantidos.
- **Desligados**: um servidor desligado sai das duas CLIs, mas a configuração dele (sem valores) fica em `<pasta de dados do app>/mcp-disabled.json`, para religar depois.
- Cada alteração troca só a entrada do servidor pedido. Outros servidores ficam como estão, e não há cópias `.bak-*`.

## Segredos (tokens, chaves)

**O LunaHarness nunca recebe, guarda nem mostra o valor de uma variável secreta.** Ele grava só o **nome** da variável:

- Claude Code: `"env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}" }`. O Claude expande a referência com o valor do ambiente ao iniciar o servidor (testado com uma variável de teste num diretório temporário).
- Codex: `env_vars = ["GITHUB_PERSONAL_ACCESS_TOKEN"]`. O Codex repassa ao servidor só essas variáveis, lidas do ambiente.

Para configurar um servidor que pede variável:

1. Defina a variável nas **variáveis de ambiente do seu usuário** no Windows (Configurações > Sistema > Sobre > Configurações avançadas do sistema > Variáveis de ambiente).
2. Reinicie o LunaHarness e as CLIs. Variáveis definidas no Windows só valem para processos abertos depois disso.
3. Instale o servidor normalmente. A instalação não pede o valor.

**Formato antigo.** Versões anteriores gravavam o valor escrito no arquivo. Quando o LunaHarness encontra isso, mostra só o nome da variável no cartão, com a mensagem "Segredo gravado em texto". Nesse caso:

1. Defina a variável no ambiente, como acima.
2. Clique em **Reconfigurar**. O app remove a entrada pelo nome e grava de novo com a referência. Enquanto houver segredo em texto, **Desligar** e **Ligar** ficam bloqueados.

Limites conhecidos:

- Um processo herda o ambiente do usuário, como qualquer programa. O LunaHarness não lê nem exibe o valor, mas o servidor e a CLI recebem a variável, como esperado.
- Cabeçalhos de servidor remoto escritos à mão não são analisados; use servidores locais para tokens.
- Argumentos de linha de comando (`args`) que contenham um segredo não são detectados.
- Os arquivos de backup criados por versões anteriores (`*.bak-*`) podem conter tokens antigos. Apague-os manualmente se existirem.

## Tipos

- **Local (stdio)**: um comando e argumentos, com variáveis por nome. Ex.: `npx -y @modelcontextprotocol/server-memory`.
- **Remoto (http)**: um endereço `https://` (ou `http://` só para `localhost` e `127.0.0.1`). Servidor remoto não recebe variáveis por enquanto.

## Adicionar

**Pelo app**, em **Configurações > MCP**:

- **Marketplace**: escolha o servidor e **Instalar**. O diálogo mostra o comando exato (ou a URL) e as variáveis que o servidor lê, e exige marcar a confirmação antes de gravar.
- **Adicionar MCP**: informe nome, tipo, comando (ou endereço), argumentos e os **nomes** das variáveis, separados por vírgula. Não cole valores aqui.

**Pelo terminal**:

```bash
luna mcp add memoria
```

O `luna` chama o próprio app (`lunaharness mcp add`), que mostra o comando, os nomes das variáveis e pede confirmação `(s/N)`. A gravação segue a mesma regra da tela. O app precisa ter sido compilado: rode `luna` uma vez antes.

## Catálogos

- **LunaHarness oficial**: `src-tauri/marketplace/mcp.json`.
- **Catálogo por URL**: só `https://`, guardado em `<pasta de dados do app>/mcp-catalogs.json`. Cada entrada tem `id`, `name`, `description`, `author`, `transport` (`stdio` ou `http`), `command`/`args` ou `url`, e `env`, uma lista de `{ "key": "NOME", "label": "instrução" }`. Os valores **não** entram no catálogo.

## Segurança

- **Um servidor MCP roda um programa no seu computador.** Por isso a instalação mostra o comando exato e só grava depois da confirmação. Não há instalação silenciosa.
- Nomes de variável aceitam só letras, números e `_`.
- Pacotes `npx` do catálogo oficial não estão fixados em versão. Revise o que roda antes de instalar.

## Excluir

Na aba **Instalados**, **Excluir** remove o servidor das duas CLIs, depois de confirmação, e apaga também a configuração guardada para religar.
