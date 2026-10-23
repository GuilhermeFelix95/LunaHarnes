# Spec: navegador essencial, preenchimento de senhas e clonador de sites

## Problem Statement

O modo navegador do LunaCode tem três problemas que atrapalham o uso diário. A sidebar do chat fica cortada nesse modo. Os favoritos importados não aparecem na barra de favoritos até a janela ser reaberta. As senhas importadas ficam guardadas, mas não são usadas nas páginas, e a pessoa precisa copiá-las à mão das Configurações.

Faltam também atalhos básicos de navegador (nova aba, fechar aba, barra de endereço), uma forma de buscar no histórico e os botões de voltar, avançar e recarregar nem sempre aparecem.

Além disso, quem quer criar uma interface parecida com a de um site não tem como partir de um link. Essa pessoa precisa reconstruir layout, cores e componentes do zero.

A mensagem em vermelho "OpenCode terminou sem concluir a resposta (código 1)" aparece sem explicação, e ainda não se sabe a causa.

## Solution

O navegador ganha uma barra de favoritos sempre visível, com os favoritos importados aparecendo logo após a importação. Os botões de voltar, avançar e recarregar ficam sempre visíveis.

As senhas importadas passam a ser sugeridas no painel do navegador quando a página abre um formulário de login do mesmo endereço. A pessoa escolhe a senha e só então ela é preenchida. Nenhuma senha é preenchida sem clique, e nenhuma senha vai para um endereço diferente do salvo.

Os atalhos Ctrl+T (nova aba), Ctrl+W (fechar aba) e Ctrl+L (foco na barra de endereço) funcionam com a página aberta. Ctrl+F abre uma barra de endereço flutuante no centro da tela, no estilo do Spotlight do Mac, e não a busca dentro da página.

O histórico tem um campo de busca que filtra as visitas por texto.

No modo navegador, a sidebar do chat fica recolhida em ícones, sem cortar o conteúdo. O seletor de permissão e as ações de edição do composer somem, porque esse modo só conversa e resume a página.

Um botão novo "Clonador de sites", ao lado de Alterações, abre um painel onde a pessoa cola a URL. Antes de copiar, um aviso sobre direitos autorais precisa ser aceito. Depois, o app captura a estrutura visual da página e pede ao agente que recrie o front-end. Ao final, o agente pergunta se mantém as cores do site ou usa as do projeto atual. O resultado aparece num preview dentro do painel.

## User Stories

1. Como usuária do navegador, quero que os favoritos que importei apareçam na barra de favoritos logo após a importação.
2. Como usuária do navegador, quero que a barra de favoritos fique sempre visível, para abrir um site salvo com um clique.
3. Como usuária do navegador, quero ver sempre os botões de voltar, avançar e recarregar, para navegar sem procurar.
4. Como usuária do navegador, quero que minhas senhas importadas sejam sugeridas quando eu abrir uma página de login do mesmo endereço.
5. Como usuária do navegador, quero escolher a senha antes de ela ser preenchida, para nunca enviar uma senha sem eu decidir.
6. Como usuária do navegador, quero que nenhuma senha seja preenchida em outro endereço, para proteger minhas contas.
7. Como usuária do navegador, quero buscar no histórico pelo texto do título ou do endereço.
8. Como usuária do navegador, quero Ctrl+T para abrir uma aba nova, Ctrl+W para fechar a aba atual e Ctrl+L para ir à barra de endereço.
9. Como usuária do navegador, quero Ctrl+F abrir uma barra de endereço flutuante no centro da tela.
10. Como usuária do modo navegador, quero que a sidebar do chat fique recolhida em ícones, sem cortar o texto.
11. Como usuária do modo navegador, quero que o seletor de permissão e as ações de edição não apareçam, porque esse modo só conversa e resume a página.
12. Como criadora de interfaces, quero colar a URL de um site e abrir o clonador ao lado de Alterações.
13. Como criadora de interfaces, quero ver um aviso sobre direitos autorais antes de o app copiar o visual de um site, e precisar confirmar para continuar.
14. Como criadora de interfaces, quero que o agente me pergunte, ao final, se mantém as cores do site ou usa as do projeto atual.
15. Como criadora de interfaces, quero ver um preview do site recriado dentro do painel.
16. Como usuária do OpenCode, quero entender o motivo quando a resposta termina com erro, em vez de só ver um código.

## Implementation Decisions

- O front-end é feito em React e TypeScript, com a estrutura de componentes e testes já existente no projeto. Não há troca de framework.
- O back-end é feito em Rust, dentro do Tauri, com a mesma forma de comandos e eventos dos outros módulos.
- O navegador embutido é uma webview nativa. Scripts são injetados nas páginas somente para encaminhar atalhos e para o preenchimento de login.
- Senhas importadas continuam criptografadas com a proteção do sistema operacional. Cada senha fica ligada ao endereço exato de origem.
- O preenchimento de login acontece somente após uma ação explícita da pessoa, no painel do navegador. Não há preenchimento automático ao abrir a página.
- Preenchimento só ocorre quando o endereço da página atual é idêntico ao endereço salvo. Subdomínios e outros endereços não recebem senha.
- Ctrl+F é tratado pelo app e não pela página; a busca dentro da página não é substituída.
- A barra de endereço flutuante abre no centro da janela e fecha com Escape ou clique fora.
- A sidebar do chat no modo navegador é recolhida em ícones, sem corte de conteúdo.
- O seletor de permissão e as ações de edição não são exibidos no modo navegador.
- O clonador de sites é uma aba do painel direito, ao lado de Alterações.
- O clonador exige aceitar um aviso sobre direitos autorais antes de capturar qualquer página.
- A captura usa a estrutura visual da página aberta (estrutura do documento, estilos aplicados e recursos visíveis). O resultado é enviado ao agente como pedido de recriação.
- Ao final da recriação, o agente pergunta se as cores do site devem ser mantidas ou substituídas pelas do projeto atual.
- O preview do site gerado aparece dentro do painel do clonador.
- Os textos novos existem em português e inglês.
- A aba Alterações, o cache de prompt, a lógica de permissão e de diff e a API pública de plugins não mudam.

## Testing Decisions

Os testes verificam só o comportamento externo: o que a pessoa vê e o que acontece nas páginas.

- Ao importar favoritos, eles aparecem na barra sem reabrir o navegador.
- A barra de favoritos continua visível com a lista preenchida.
- Os botões de voltar, avançar e recarregar aparecem sempre no modo navegador.
- O campo de busca do histórico mostra só as visitas que contêm o texto digitado.
- Ctrl+T abre uma aba nova; Ctrl+W fecha a aba atual; Ctrl+L coloca o foco na barra de endereço.
- Ctrl+F abre a barra de endereço flutuante e não abre a busca da página.
- Nenhuma senha é preenchida sem clique da pessoa.
- Uma senha só é sugerida quando o endereço da página é idêntico ao salvo. Subdomínio diferente não recebe a senha.
- No modo navegador, a sidebar do chat aparece recolhida e o seletor de permissão não aparece.
- O clonador só captura uma página depois de o aviso de direitos autorais ser aceito.
- Ao fim da recriação, o agente pergunta sobre as cores antes de finalizar.
- O preview mostra o site gerado no painel do clonador.
- Quando a resposta termina com erro, a mensagem explica a causa, quando ela for conhecida.

## Out of Scope

- Preenchimento automático de senha ao abrir a página, sem clique.
- Clonagem de animações complexas que dependem de script da página de origem.
- Sincronização de senhas com serviços externos.
- Extensões do navegador e ferramentas de desenvolvedor, como inspeção de elementos.
- Mudança na aba Alterações, no cache de prompt e na API pública de plugins.
- Atualização dos READMEs em outros idiomas.

## Further Notes

- Clonar um site pode violar direitos autorais e termos de uso. O aviso é obrigatório e a responsabilidade pelo uso do resultado é da pessoa.
- Sites com política de segurança restritiva podem bloquear a captura da estrutura da página ou o preenchimento de login. Nesses casos, a funcionalidade informa a limitação, sem contornar a restrição.
- A causa do erro do OpenCode depende de reprodução com o motor instalado e logado. Se a causa estiver fora do código (login, modelo ou configuração), a spec registra a condição e não propõe correção de código.
