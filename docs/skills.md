# Skills

Skill é uma pasta com um `SKILL.md` que o Claude Code e o Codex leem como instrução reutilizável. Instalada pelo LunaHarness, ela vale nas duas CLIs, em todas as conversas e no terminal.

## Onde ficam

- `~/.claude/skills/<id>/SKILL.md` (Claude Code)
- `~/.codex/skills/<id>/SKILL.md` (Codex)

O menu `/` do composer lista as skills dessas pastas. Uma skill nova aparece na próxima conversa.

## Formato

Cada skill tem uma pasta com `SKILL.md`. O cabeçalho do arquivo precisa de `name` e `description`:

```markdown
---
name: Revisar mudanças
description: Revisa o diff atual e aponta riscos antes do commit.
---

Instruções para o agente...
```

## Instalar

Pela tela **Configurações > Skills**, na aba **Marketplace**, clique em **Instalar**.

Pelo terminal:

```bash
luna skills add revisar-diff
```

O comando confere o sha256 de cada arquivo com o catálogo, grava nas duas CLIs e recusa se a skill já existir.

## Catálogos

- **LunaHarness oficial**: `src-tauri/marketplace/skills.json`, embutido no app.
- **Catálogo por URL**: na aba Marketplace, **Adicionar catálogo** aceita só endereço `https://`. O app baixa, confere o formato e guarda a URL em `<pasta de dados do app>/skills-catalogs.json`. Remover um catálogo não apaga skills já instaladas.

Formato do catálogo:

```json
{
  "name": "Nome do catálogo",
  "skills": [
    {
      "id": "revisar-diff",
      "name": "Revisar mudanças",
      "description": "Revisa o diff atual.",
      "author": "Autor",
      "version": "1.0.0",
      "files": [
        { "path": "SKILL.md", "sha256": "<64 hex>", "content": "---\nname: ...\n---\n..." }
      ]
    }
  ]
}
```

Regras: `id` só com letras minúsculas, números e hífen; `SKILL.md` obrigatório; até 20 arquivos por skill, 64 KB cada; caminhos sem `..`.

## Segurança

- Uma skill é texto que o agente segue. Instale só de fontes em que você confia, porque ela pode mandar o agente fazer coisas.
- Os arquivos são conferidos pelo sha256 antes de qualquer escrita. Se um hash não bate, nada é instalado.
- Downloads de catálogo têm tempo limite e tamanho máximo de 1 MB.

## Excluir

Na aba **Instaladas**, **Excluir** remove a pasta das duas CLIs. Pelo app a exclusão pede confirmação.
