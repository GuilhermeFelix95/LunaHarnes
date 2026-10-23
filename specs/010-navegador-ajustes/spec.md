# Spec: ajustes da barra de endereço, prévia do clonador no navegador e marcação beta

## Problem Statement

Na barra de endereço do navegador embutido, um clique seleciona o endereço inteiro e a seleção desaparece logo em seguida. Quem clica quer substituir o endereço de uma vez e não consegue. Além disso, a prévia do clonador de sites aparece dentro do chat, num quadro pequeno, quando deveria aparecer no navegador embutido, onde a página se comporta como numa navegação normal. O clonador também ainda é experimental, e a interface não deixa isso claro.

## Solution

Um clique na barra de endereço, quando ela ainda não tem foco, seleciona o endereço inteiro e mantém a seleção. Quando o clone termina, a prévia abre numa aba do navegador embutido, servida pelo próprio app a partir da pasta do clone, sem sair da máquina. O clonador aparece marcado como beta no menu de comandos e no cabeçalho do fluxo, nos dois idiomas.

## User Stories

1. Como usuário, quero clicar na barra de endereço e ver o endereço inteiro selecionado, para substituí-lo digitando.
2. Como usuário, quero que a seleção continue depois que eu solto o botão do mouse.
3. Como usuário, quero que Ctrl+L e Tab continuem selecionando o endereço inteiro.
4. Como usuário, quero abrir a prévia do clone no navegador embutido, em vez de no chat.
5. Como usuário, quero que a prévia só mostre o que está na pasta do clone, sem acesso a arquivos do resto do projeto.
6. Como usuário, quero ver que o clonador é beta, antes de usá-lo.

## Implementation Decisions

- A seleção do endereço é tratada no momento do clique, antes de o navegador posicionar o cursor. Foco pelo teclado continua selecionando tudo.
- A prévia é servida por um endereço local do próprio app, só para a pasta do clone escolhida. Só arquivos de página, imagem, fonte e estilo são entregues, e nada fora da pasta.
- A prévia abre numa aba do navegador embutido, pelo mesmo caminho que o chat já usa para abrir páginas.
- A marcação beta aparece onde o clonador é oferecido: no menu de comandos e no cabeçalho do fluxo de clonagem.
- Os textos novos existem em português e inglês.

## Testing Decisions

- Um clique numa barra de endereço sem foco deixa o endereço inteiro selecionado, e a seleção continua depois de soltar o botão.
- Foco pelo teclado seleciona o endereço inteiro, e um clique depois dele não é cancelado.
- Pedir a prévia de uma pasta de clone devolve um endereço que mostra a página dessa pasta.
- Caminhos que saem da pasta do clone (com `..`, com barra ou arquivo de fora) não são entregues.
- Pastas com nome inválido são recusadas antes de servir qualquer coisa.
- O clonador aparece marcado como beta no menu e no cabeçalho do fluxo.

## Out of Scope

- Prévia dentro do chat (substituída pela aba do navegador).
- Atualização automática da prévia quando o agente muda arquivos (a pessoa recarrega com o botão do navegador).
- Mudança no conteúdo que o clone copia ou na forma como o agente o gera.
- Publicação da release em outros canais além do GitHub.

## Further Notes

- Esta spec fica em `specs/010-navegador-ajustes`, porque `specs/004` tem a spec de permissões, e as specs 008 e 009 já são de outros ciclos.
- O clone é gerado pelo agente a partir da página capturada. A prévia roda o HTML do clone num endereço local, e o aviso de direitos autorais do fluxo continua valendo.
