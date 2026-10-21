# Navegador da barra direita, ícone da janela e ritmo das animações

## Problem Statement

Quatro pontos atrapalham o uso do app.

O ícone da janela aparece genérico quando o app roda pelo comando de desenvolvimento, mesmo com o ícone certo no repositório. As animações do app são rápidas demais para a leitura dos menus e dos painéis, e os valores de tempo estão espalhados pelos componentes em vez de vir do tema.

O navegador da barra direita não pesquisa quando o usuário digita um texto que não é endereço. Também não tem histórico, não tem um modo de tela grande para navegar com calma e não aceita a importação de favoritos, histórico e senhas que o usuário exporta do Chrome ou do Edge.

## Solution

A janela principal passa a mostrar o ícone do app já na inicialização, usando o ícone que está no repositório.

As durações e as curvas de animação vêm do tema em todo o app, com valores um pouco mais longos e suaves, e o movimento reduzido continua zerando as animações.

O endereço do navegador aceita texto livre: quando não é um endereço, a busca vai para o motor escolhido nas Configurações. O navegador ganha histórico e importação de favoritos, histórico e senhas exportados pelo próprio navegador. As senhas importadas ficam guardadas de forma criptografada, numa lista do app para consulta e cópia.

Um modo navegador expande o painel direito para ocupar a tela, com a barra de abas e o endereço, e recolhe o chat para uma faixa lateral. Voltar ao modo normal restaura o layout anterior.

## User Stories

1. Como usuário, quero que a janela mostre o ícone do app quando eu rodo o modo de desenvolvimento, para reconhecer o app na barra de tarefas.
2. Como usuário, quero que os menus e os painéis tenham um ritmo de animação mais fácil de acompanhar.
3. Como usuário que prefere menos movimento, quero que todas as animações parem quando o sistema pede movimento reduzido.
4. Como usuário, quero digitar uma pesquisa na barra de endereço e receber os resultados do motor que escolhi.
5. Como usuário, quero escolher o motor de busca nas Configurações (Google, DuckDuckGo, Bing ou Brave).
6. Como usuário, quero um histórico de páginas visitadas, com limite, para voltar a elas.
7. Como usuário, quero importar meus favoritos, meu histórico e minhas senhas exportados do Chrome ou do Edge.
8. Como usuário, quero que as senhas importadas fiquem protegidas em disco e só apareçam quando eu pedir.
9. Como usuário, quero abrir o navegador em tela grande, com o chat recolhido ao lado, e voltar ao layout normal depois.

## Implementation Decisions

- O frontend é React com TypeScript. Os estilos são arquivos CSS do próprio projeto, sem framework de estilos.
- O backend do app é Tauri 2 com Rust. Comandos novos seguem o padrão dos comandos existentes: validação do lado Rust, erro com mensagem clara e registro no mesmo ponto de entrada.
- O navegador continua sendo o motor embutido do Windows (WebView2). Nenhum outro motor é introduzido.
- Extensões do Chrome não são suportadas, porque o WebView2 não instala extensões da Chrome Web Store.
- O motor de busca padrão é o Google. O usuário escolhe entre Google, DuckDuckGo, Bing e Brave.
- O histórico do navegador fica guardado no armazenamento do app, em formato simples, com teto de 500 itens.
- As senhas importadas são criptografadas com a proteção do próprio sistema operacional, ligada ao usuário do Windows. Elas não são gravadas em texto puro.
- A importação aceita os arquivos exportados pelo próprio navegador: CSV de senhas e HTML no formato de favoritos e histórico.
- As durações e curvas de animação vêm dos tokens do tema. Componentes não usam tempos fixos.
- O modo navegador ocupa a tela com o painel direito; o chat fica recolhido e volta ao tamanho normal ao sair do modo.
- Textos novos entram nos dicionários de português do Brasil e inglês.
- Testes automatizados usam Vitest no frontend e cargo test no backend.

## Testing Decisions

Os testes verificam só o comportamento externo: o que o usuário vê e o que o backend devolve.

- Um texto que não é endereço abre a pesquisa no motor escolhido; um endereço continua abrindo a página.
- O motor padrão é o Google.
- O histórico guarda as visitas em ordem e nunca passa de 500 itens.
- A importação lê os favoritos, o histórico e as senhas dos arquivos exportados pelo navegador.
- As senhas gravadas no disco não aparecem em texto puro e voltam íntegras quando lidas.
- O botão do modo navegador expande o painel, recolhe o chat, e voltar restaura o layout anterior.
- Todas as durações de animação vêm dos tokens do tema, e o movimento reduzido as zera.
- Verificação manual: abrir o app em modo de desenvolvimento e conferir o ícone, as animações, a pesquisa, o histórico, a importação e o modo navegador.

## Out of Scope

- Extensões do Chrome.
- Preenchimento automático de senhas nos formulários das páginas. As senhas ficam numa lista do app para consulta e cópia.
- Sincronização de histórico, favoritos ou senhas entre computadores.
- Troca do motor do navegador.
- Mudança no fluxo do turno do chat e no seletor de esforço.
- Alteração das ferramentas do agente no navegador.
- Novas animações de entrada.

## Further Notes

- O trabalho é dividido em branches separadas, criadas a partir da main, sem push e sem merge.
- As senhas exigem uma proteção por usuário do sistema; se a proteção não estiver disponível, a importação de senhas falha com mensagem clara e as demais importações seguem.
- Para a importação de arquivos, o app usa o seletor de arquivos do próprio sistema.
- A verificação manual depende de ver o app rodando no Windows.
