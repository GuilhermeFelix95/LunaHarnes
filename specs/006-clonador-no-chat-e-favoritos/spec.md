# Spec: clonador de sites no chat e favoritos em uma linha

## Problem Statement

O clonador de sites hoje é uma aba do painel lateral que só mostra um resumo do site: título, cores, animações e componentes. Ele não cria nada, não pergunta o que a pessoa quer copiar e não mostra o resultado.

A barra de favoritos do navegador quebra em várias linhas ou rola para o lado quando há muitos favoritos. Quem tem muitos favoritos não enxerga todos de uma vez, e a rolagem é pouco visível.

## Solution

O clonador passa a ser um fluxo no chat, aberto por um botão ao lado de Meta no composer. A pessoa escolhe o que quer copiar, dá um nome à pasta, informa o endereço do site, confirma o aviso de direitos e o agente recria o site numa subpasta do projeto atual, usando a captura. Ao final, a pessoa vê uma prévia do site gerado.

A aba Clonador do painel lateral deixa de existir.

A barra de favoritos fica em uma linha, sem rolagem. Os favoritos que não cabem aparecem atrás de um botão `»` no fim da linha, que mostra a lista completa, como no Firefox.

## User Stories

1. Como usuário, quero um botão ao lado de Meta para iniciar a clonagem, sem abrir outro painel.
2. Como usuário, quero escolher no chat o que copiar do site (layout e estrutura, cores, componentes, tipografia, animações, textos e imagens), para que o resultado tenha só o que me interessa.
3. Como usuário, quero dar o nome da pasta do clone, para encontrar o resultado depois.
4. Como usuário, quero informar o endereço do site e confirmar que tenho direitos sobre o conteúdo antes de qualquer cópia.
5. Como usuário, quero que o clone seja salvo dentro da pasta do meu projeto, numa subpasta com o nome que escolhi.
6. Como usuário, quero ver uma prévia do site gerado depois que ele for criado, sem sair do chat.
7. Como usuário, quero que as cores do clone sejam as do site copiado.
8. Como usuário, quero ser avisado, antes de começar, quando não há pasta de projeto ou quando a permissão atual não deixa escrever arquivos.
9. Como usuário, quero ver todos os meus favoritos mesmo quando a barra está cheia, sem barra de rolagem.
10. Como usuário, quero abrir um favorito que está escondido atrás do botão `»`, com um clique.
11. Como usuário, quero que o botão do clonador some no modo navegador, como o botão Meta.

## Implementation Decisions

- O frontend continua em React, e o backend continua em Rust com Tauri. Nenhum framework novo é adotado para o fluxo, a prévia ou a barra de favoritos.
- O clonador não copia o código-fonte original do site. O agente do chat recria o site com base na captura feita pelo app e nas opções escolhidas.
- O clone é salvo dentro da pasta do projeto atual, numa subpasta com o nome escolhido pela pessoa. O nome aceita apenas letras, números, espaços, hífen e sublinhado, e não pode conter separadores de caminho nem sequências de subida de diretório.
- As perguntas do fluxo usam o mesmo mecanismo de seletor de perguntas já existente no chat, com as seis opções de conteúdo, em seleção múltipla.
- As cores do clone são as do site copiado. A escolha de cores do projeto não existe nesta versão.
- O aviso de direitos autorais é obrigatório: sem a confirmação, nada é capturado nem enviado.
- A prévia mostra apenas o site gerado. Ela roda isolada do app, sem acesso a dados da aplicação, e não carrega recursos de rede além do próprio arquivo gerado.
- Sem pasta de projeto aberta, o botão do clonador fica indisponível e explica o motivo.
- Com a permissão `Só leitura`, o app avisa antes de iniciar, porque o agente não consegue criar os arquivos, e oferece trocar a permissão.
- A barra de favoritos não tem barra de rolagem. Os favoritos que não cabem na linha ficam no menu do botão `»`.
- A política de conteúdo da janela (CSP) não é afrouxada para isso.
- Os textos novos existem em português e inglês.
- A API pública de plugins não muda.

## Testing Decisions

Os testes verificam só o comportamento externo: o que a pessoa observa na tela e o que o chat envia.

- O botão do clonador aparece ao lado de Meta fora do modo navegador e não aparece dentro dele.
- Sem o aviso de direitos marcado, nenhum endereço é capturado.
- Um nome de pasta com separador de caminho ou sequência de subida é recusado com uma mensagem clara.
- Uma escolha completa (opções, nome, endereço, aviso) envia ao agente um pedido que contém o endereço, a subpasta e as opções escolhidas.
- Sem pasta de projeto, o botão fica indisponível e mostra o motivo.
- Com `Só leitura`, o app avisa antes de enviar o pedido de clonagem.
- Depois da criação, a prévia mostra o site gerado; quando o arquivo principal não existe, mostra uma mensagem clara.
- Os favoritos que não cabem na barra aparecem no menu do botão `»`, e a barra não tem rolagem.
- Escolher um favorito do menu `»` abre a página.
- Os textos novos aparecem em português e em inglês.

## Out of Scope

- Copiar o código-fonte original do site.
- Escolha de cores do projeto para o clone.
- Captura de páginas que dependem de JavaScript para montar o conteúdo.
- Sites com ícone em outro caminho que não `/favicon.ico` (já registrado em trabalho anterior).
- Mudança na aba Alterações e nos motores de conversa.
- Mudança na API pública de plugins.
- Atualização dos READMEs em outros idiomas.

## Further Notes

- A spec de permissões, velocidade e diff continua em `specs/004-atualize-o-reamde-pra-deixar-atualizado/spec.md`, sem alteração.
- A recriação depende do motor escolhido no chat, então o resultado varia entre motores.
- Clonar exige escrita de arquivos. Em `Só leitura` a escrita fica bloqueada, e o fluxo deixa isso explícito antes de começar.
- A medição da largura dos favoritos é refeita quando a janela muda de tamanho.
