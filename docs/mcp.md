# Servidores MCP

Servidores MCP dão ferramentas extras ao agente, como memória ou acesso ao GitHub. O LunaHarness grava os servidores nas configurações globais das duas CLIs, então eles valem para o Claude Code e para o Codex, em todas as conversas e no terminal.

## Onde ficam

- **Claude Code**: chave `mcpServers` em `~/.claude.json`. As outras chaves do arquivo são preservadas, e antes de cada escrita o app grava uma cópia `~/.claude.json.bak-<segundos>`.
- **Codex**: tabelas `[mcp_servers.<nome>]` em `~/.codex/config.toml`, editadas com `toml_edit`, então comentários e a ordem do arquivo são mantidos.
- **Desligados**: um servidor desligado sai das duas CLIs, mas a configuração dele fica guardada em `<pasta de dados do app>/mcp-disabled.json` para religar sem perder nada.

## Tipos

- **Local (stdio)**: um comando e argumentos. Ex.: `npx -y @modelcontextprotocol/server-memory`.
- **Remoto (http)**: um endereço `https://`. Endereço `http://` só é aceito para `localhost` e `127.0.0.1`.

## Adicionar

**Pelo app**, em **Configurações > MCP**:

- **Marketplace**: escolha o servidor e **Instalar**. O diálogo mostra o comando exato (ou a URL), pede as variáveis (ex.: token) e exige marcar a confirmação antes de gravar.
- **Adicionar MCP**: informe nome, tipo, comando (ou endereço) e variáveis, uma por linha (`CHAVE=valor`). A mesma confirmação é pedida.

**Pelo terminal**:

```bash
luna mcp add memoria
```

O comando mostra o que será executado com os valores escondidos, pede confirmação `(s/N)` e roda `claude mcp add` e `codex mcp add`, os comandos oficiais de cada CLI. Se uma CLI não estiver instalada, a outra ainda é configurada e o resultado de cada uma aparece na saída.

## Catálogos

- **LunaHarness oficial**: `src-tauri/marketplace/mcp.json`.
- **Catálogo por URL**: mesma regra das skills. Só `https://`, guardado em `<pasta de dados do app>/mcp-catalogs.json`.

Cada entrada do catálogo declara `id`, `name`, `description`, `author`, `transport` (`stdio` ou `http`), `command`/`args` ou `url`, e `env` com as variáveis pedidas (`key` e `label`).

## Segurança

- **Um servidor MCP roda um programa no seu computador.** Por isso a instalação mostra o comando exato e só grava depois da confirmação. Não há instalação silenciosa.
- **Variáveis secretas (tokens) ficam em texto puro nas configurações das CLIs**, como `claude mcp add -e` faz. Não estão no cofre do Windows. Use tokens com o menor escopo possível.
- Valores digitados pelo terminal só aceitam caracteres que o shell não interpreta (letras, números e `-_.:/+=@`).
- Pacotes `npx` do catálogo oficial não estão fixados em versão. Revise o que roda antes de instalar.

## Excluir

Na aba **Instalados**, **Excluir** remove o servidor das duas CLIs, depois de confirmação, e apaga também a configuração guardada para religar.
