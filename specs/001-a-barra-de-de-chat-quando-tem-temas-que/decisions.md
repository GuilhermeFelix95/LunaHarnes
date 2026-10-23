# Decisões

## Rodada 1
- Onde o corte deve ser corrigido?: Só o campo de mensagem do chat
- Quais formatos de tema devem ficar corretos?: Todos os 13 formatos
- Como corrigir o campo de texto?: Limitar o raio do campo (com teto de 12px) e aumentar o padding interno
- Sobre quebra de palavras: o que fazer com palavra longa (URL, código) que não cabe na linha?: Quebrar só entre palavras; palavra longa rola na horizontal
- Nome da branch para este trabalho?: fix/campo-texto-formatos

## Rodada 2
- Qual é o papel da especificação de cache que você colou?: Outra tarefa; neste branch só corrijo o campo de mensagem
- O teto de 12px vale só para o textarea, e a moldura do composer mantém o raio do formato escolhido?: Sim: só o textarea recebe o teto; a moldura segue o formato

## Rodada 3
- O que você quer melhorar visualmente no menu de worktree/branch?: Marcar a branch atual com destaque
- Quando você diz que a branch 'não aparece', o que exatamente falta?: A branch nova não entra na lista do menu de branch
- Como tratar etapa que ficou 'em andamento' quando o turno termina?: Corrigir o agente: ele deve marcar todas as etapas como concluídas antes de terminar, e o app não muda
- Como a imagem enviada deve aparecer no histórico?: Miniatura no balão do usuário, guardada na conversa (continua depois de recarregar)

## Rodada 4
- Em qual menu a branch nova não aparece?: no menu de branch quando clico na main nao aparece anov que voce criou, assimq ue cria pelo chat que eu pedi deveria ja aparecer em tmepo real e marcar ela ali e nao ficar na main
- Como guardar a miniatura da imagem para ela aparecer depois de recarregar?: Guardar o caminho do arquivo que já está na pasta de anexos e carregar a miniatura quando for exibir
- Onde colocar a instrução para o agente fechar todas as etapas antes de terminar?: No texto de aprovação do plano, que é enviado quando o plano começa a ser executado

## Rodada 5
- 1) No campo 'nova-branch', o que deve seguir o tema atual? (o print mostra cantos retos e cor fixa, fora do estilo do menu): Raio dos cantos e cores (tudo do tema)
- 2) O que você quer com o 'modo goal'?: Comando /goal: o agente segue até uma condição de término ser cumprida
- 3) Qual ícone aparece genérico quando o app está instalado?: Ícone do app instalado (atalho, barra de tarefas, instalador do Windows)

## Rodada 6
- 1) O ícone genérico aparece em qual lugar, no app já instalado?: Instalador (.exe de setup)
- 2) Para o ícone, a correção deve ser reinstalar a partir de um build novo, sem mudar código (o ícone já está no repositório), ou trocar o arquivo do ícone?: Só build e reinstalação, sem mudar código
- 3) Como o /goal deve funcionar?: Comando da Luna que reenvia o pedido até a condição de término ser cumprida, com limite de rodadas
- 4) No campo 'nova-branch', o que ajustar além do campo de texto?: Campo e botão 'Criar' com o tema

## Rodada 7
- 1) Quem decide que a condição do /goal foi cumprida?: O próprio agente sinaliza ao fim de cada rodada e a Luna confere o sinal
- 2) Qual limite de rodadas para o /goal?: ate finalizar, mas so deve ser ativado se ele clicar no icone de goal, um icone perto do anexar, deve ser um icone exclusivo
- 3) Onde o /goal aparece para o usuário?: No menu de / do composer, como comando da Luna (ex.: /goal condição)

## Rodada 8
- 1) O /goal ativa só pelo ícone ao lado do anexar, ou também pelo menu de /?: pelo icone e pelo comando o nome do meu comando nao deve ser goalqual sua sugestao? eu pensei em outra coisa sei la ema juda ai em um nome leagal
- 2) Até quando o /goal repete, se o agente nunca sinalizar que terminou?: Até o agente sinalizar, com teto de segurança de 20 rodadas e botão para parar a qualquer momento
- 3) Depois de enviar uma mensagem com o ícone ligado, o modo continua ligado?: Não: vale só para essa mensagem e desliga ao terminar

## Rodada 9
- 1) Qual nome o comando deve ter no menu de /? (o ícone ao lado do anexar também usa esse mesmo nome): /meta

## Rodada 10
- Para as animações, o que você quer deixar mais bonito? (pode marcar mais de uma): Indicador deslizante que acompanha o item ativo no menu lateral
- O que significa 'subagente em segundo plano' para você?: Delegar uma tarefa a um subagente que roda enquanto eu continuo conversando no chat
- Onde você quer acompanhar e parar os subagentes em segundo plano?: Lista na própria conversa, com status e botão para parar
- Em quais motores o recurso deve funcionar?: Só Claude, que é o único que tem subagentes no CLI hoje

## Rodada 11
- Como o subagente em segundo plano deve rodar, já que o processo do turno termina com o turno?: Processo próprio do Claude CLI, iniciado pelo app, com status e botão para parar; a conversa continua livre
- Quem inicia a tarefa em segundo plano?: Um comando do menu de / (ex.: /subagente tarefa), que eu uso quando quiser
- O que acontece quando o subagente termina?: A conversa recebe uma mensagem com o resultado, na hora em que ele termina

## Rodada 12
- No terminal, como abrir mais de um?: Botão + no painel, cada terminal vira uma aba dentro do painel
- Deve haver um limite de terminais abertos ao mesmo tempo?: Até 4 terminais
- No orquestrador, como o campo de esforço deve aparecer?: Só quando o modelo escolhido tem níveis de esforço; sem escolha, usa o padrão do modelo
- O papel de subagente das etapas também deve receber o esforço escolhido?: Sim, o arquivo de --agents passa a levar o esforço

## Rodada 13
- A imagem do ícone mostra onde o ícone errado aparece? Pela miniatura, parece um ícone padrão de janela com fundo roxo.: Barra de tarefas e janela do app quando roda pelo comando de dev (npm run dev:app)
- Para deixar as animações fluidas no app todo, qual ajuste você quer?: Aumentar as durações dos tokens (de 200 ms para algo entre 300 e 350 ms), usar uma curva mais suave e trocar os valores fixos por tokens
- Na barra de endereço do navegador, o que deve acontecer quando eu digito um texto que não é endereço?: Pesquisar no motor escolhido em Configurações (Google, DuckDuckGo, Bing ou Brave)
- Extensões do Chrome: como você quer tratar isso?: Não suportar extensões: o WebView2 do Windows não instala extensões da Chrome Web Store; ofereço favoritos, histórico e senhas nativos
- Modo navegador na barra direita: como ele deve ocupar a tela?: O painel direito vira um navegador grande, com a barra de abas e o endereço, e o chat fica recolhido ao lado

## Rodada 14
- Como importar histórico e senhas do Chrome ou do Edge?: Importar arquivos exportados pelo próprio navegador (CSV de senhas, HTML de histórico e favoritos) para um armazenamento do app, com as senhas criptografadas
- Para o ícone do modo dev, aceita uma pequena mudança de código que define o ícone da janela ao abrir o app?: Sim: definir o ícone da janela na inicialização, com o ícone que já está no repositório, e reconferir o build de dev

## Rodada 15
- No navegador, em que momento a página fica branca?: Em qualquer página, logo ao entrar
- Qual aba do painel direito parece lenta para abrir?: Todas do mesmo jeito
- Como o aviso de atualização deve aparecer?: ao lado do botao de configurações
- Com que frequência o app deve checar se há versão nova?: a forma recomendada
- Antes de instalar, quando as execuções e terminais devem ser encerrados?: Só depois que o download termina

## Rodada 16
- O que você quer que a Luna faça com os plugins do Claude Code?: Tudo acima e mostrar os comandos e skills deles no menu /
- De quais marketplaces a Luna deve instalar?: Oficial e marketplaces que eu adicionar por GitHub ou URL
- Em qual escopo a Luna instala?: Só usuário (vale em todas as conversas)
- Antes de instalar, a Luna deve mostrar o que o plugin adiciona e pedir confirmação?: Sim, sempre
