# Spec: aviso de atualização das CLIs, com atualização confirmada pelo app

## Problem Statement

O Luna usa CLIs de terceiros (Claude Code, Codex, OpenCode, Hermes e outras) para conversar com cada modelo. Quando uma dessas CLIs ganha uma versão nova, o Luna não percebe. Quem usa só fica sabendo quando algo quebra ou quando lê a notícia por fora.

Hoje o app só confere se a CLI está instalada e, no caso do Claude Code, se a versão atende o mínimo. Não há nenhuma informação sobre a versão mais nova.

## Solution

O Luna confere a versão de cada CLI ao abrir o app e depois a cada hora. Quando há versão nova, o aviso aparece em dois lugares: uma faixa acima da caixa de mensagem do chat e o cartão da CLI na tela de configurações.

A atualização roda pelo próprio app, mas só depois de uma confirmação explícita da pessoa. Enquanto o agente estiver respondendo, o aviso não aparece e a atualização não pode começar. Nas CLIs sem um comando de atualização confirmado, o aviso só leva ao instalador oficial.

## User Stories

1. Como usuário, quero saber quando a CLI de um provedor tem versão nova, sem precisar procurar.
2. Como usuário, quero ver a versão atual e a versão nova no aviso, para decidir se vale atualizar.
3. Como usuário, quero atualizar a CLI pelo app, depois de confirmar, para não precisar abrir o terminal.
4. Como usuário, quero que nada seja atualizado sem a minha confirmação.
5. Como usuário, quero que o aviso não apareça enquanto o agente está respondendo, para não ser interrompido.
6. Como usuário, quero ver o mesmo aviso no cartão de cada CLI nas configurações.
7. Como usuário, quero que a atualização não apague nem mude minhas conversas.
8. Como usuário, quero, nas CLIs que o app não consegue atualizar sozinho, um link para o instalador oficial.
9. Como usuário, quero que a falha de uma atualização apareça como mensagem clara, sem travar o Luna.

## Implementation Decisions

- A checagem roda ao abrir o app e depois a cada hora, no mesmo ritmo da checagem de atualização do próprio app.
- O aviso aparece no chat, acima da caixa de mensagem, e no cartão de cada CLI nas configurações.
- A atualização só começa depois de confirmação explícita da pessoa. Sem a confirmação, nada é executado.
- O app recusa atualizar uma CLI enquanto existe qualquer execução de agente ativa.
- Cada CLI tem um comando de atualização próprio quando ele é conhecido. Para CLIs sem comando confirmado, o app oferece só o link do instalador oficial.
- A atualização usa a mesma CLI que o app já usa para rodar, não outra instalação encontrada no computador.
- Depois de atualizar, o app confere a versão de novo e revalida a versão mínima exigida.
- Nenhuma conversa, sessão ou configuração do Luna é alterada pela atualização.
- Os dados enviados às fontes de versão são só o nome do pacote ou do projeto. Nada pessoal sai do computador.
- Falhas de rede ou de atualização viram mensagem na interface e não repetem sozinhas.
- Os textos novos existem em português e em inglês.

## Testing Decisions

Os testes verificam só o comportamento externo: o que a pessoa vê e o que acontece no computador.

- Uma CLI com versão mais nova que a instalada mostra o aviso com as duas versões.
- Uma CLI já atualizada não mostra aviso.
- O aviso não aparece enquanto o agente está respondendo, e volta quando a resposta termina.
- Pedir a atualização abre uma confirmação. Cancelar não executa nada.
- Confirmar executa a atualização e mostra o resultado.
- Sem confirmação, o app não executa a atualização, mesmo que o pedido chegue.
- Com uma resposta em andamento, a atualização é recusada.
- Uma CLI sem comando confirmado mostra só o link do instalador oficial.
- Uma falha de rede ou de atualização mostra mensagem clara, sem travar a tela.
- Uma atualização não apaga nem altera as conversas salvas.

## Out of Scope

- Atualização automática sem confirmação.
- Atualização do próprio app Luna (já existe em outro fluxo).
- Instalação de CLIs que ainda não estão no computador.
- Aviso de atualização durante uma resposta em andamento.
- Atualização de plugins de cada CLI.

## Further Notes

- A fonte da versão mais nova varia por CLI. Algumas são pacotes npm; outras não têm uma fonte pública confirmada, e nesses casos o aviso não aparece.
- Uma instalação nativa pode se atualizar sozinha em segundo plano. Nesse caso o aviso pode aparecer enquanto a atualização já está em andamento.
- Atualizar uma CLI pode mudar a saída que o Luna lê. Por isso a versão mínima é checada de novo depois de cada atualização.
- Em Windows, a atualização global por npm pode exigir permissão de administrador. A falha aparece como erro.
