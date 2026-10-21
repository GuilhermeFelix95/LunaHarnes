# App de desenvolvedor: ícone no dev, animações globais e navegador

## Problem Statement

Quando o app roda em modo de desenvolvimento (`npm run dev:app`), a barra de tarefas e a janela mostram um ícone padrão de janela com fundo roxo, que não é o ícone do app. O ícone correto já existe no repositório.

Nas animações do app todo — abrir Configurações, navegar entre seções e painéis — os movimentos ficam rápidos demais, e parte das mudanças usa durações fixas fora dos tokens do tema. Ajustar o tema não muda tudo.

O navegador embutido na barra direita navega, tem abas, favoritos e senhas salvas pelo WebView2, mas não pesquisa texto digitado que não é URL, não tem escolha de motor de busca, não tem histórico próprio e não importa favoritos, histórico e senhas de outro navegador.

## Solution

Na inicialização, o backend define o ícone da janela com o arquivo do repositório, tanto no dev quanto no instalado.

Durações de transição e curvas de movimento viram tokens do tema, com valores maiores e curva mais suave. Os lugares que usavam valores fixos passam a usar os tokens. Nenhuma animação nova aparece, e o zeramento para movimento reduzido continua valendo.

No navegador, a barra de endereço distingue URL de texto: URL navega direto, texto vira busca no motor escolhido em Configurações, com Google como padrão. O painel direito ganha o modo navegador: ele expande para tela grande, o chat recolhe para uma faixa lateral, e voltar restaura o estado anterior. O navegador ganha histórico com teto de itens, e Configurações ganha importação dos arquivos exportados pelo Chrome ou pelo Edge (CSV de senhas e HTML de favoritos e histórico). Senhas importadas ficam criptografadas, sem aparecer em texto puro, e podem ser consultadas e copiadas.

Extensões do Chrome continuam fora, porque o WebView2 não instala extensões.

## User Stories

1. Como usuário, quero que o app em modo de desenvolvimento mostre o ícone do projeto na barra de tarefas e na janela.
2. Como usuário, quero que os cliques de toda a UI tenham movimentos mais longos e suaves.
3. Como usuário, quero digitar qualquer coisa na barra de endereço e buscar no motor escolhido.
4. Como usuário, quero escolher o motor de busca em Configurações.
5. Como usuário, quero expandir o navegador para tela grande e continuar com o chat à mão.
6. Como usuário, quero consultar as páginas recentes que visitei.
7. Como usuário, quero importar favoritos, histórico e senhas que exportei do meu navegador, com senhas seguras.

## Implementation Decisions

- Frontend em React com TypeScript e estilos em CSS do próprio projeto.
- App é Tauri 2 com Rust; a navegação usa WebView2 e a escolha de motor de busca é do lado do frontend.
- Ícone da janela: definido na inicialização da sessão, com o arquivo `icon.png` que já está em `src-tauri/icons/`; nenhum arquivo de ícone novo.
- Durações base sobem para 320 ms (padrão) e 180 ms (curtas), com uma curva mais suave; a regra de movimento reduzido continua zerando as durações; valores fixos de duração nos componentes são trocados pelos tokens.
- Histórico do navegador fica em arquivo JSON do app, no mesmo padrão dos favoritos atuais, com teto de 500 itens.
- Importação aceita arquivos exportados pelo próprio navegador: CSV de senhas e HTML de favoritos e histórico (formato Netscape). Os dados vão para um armazenamento próprio do app; senhas são criptografadas com a DPAPI do usuário do Windows.
- Senhas importadas servem para consulta e cópia, não para preenchimento automático de formulários.
- Extensões do Chrome não são suportadas; o app oferece favoritos, histórico e senhas nativos.
- Texto do endereço: se parece URL (com domínio e ponto, ou esquema), navega; contrário, pesquisa.
- O navegador atual mantém suas abas e o motor WebView2, sem troca de motor.

## Testing Decisions

Os testes verificam só o comportamento externo: o que o usuário vê e o que o backend devolve.

- Sobre o ícone, o teste verifica que a inicialização carrega o ícone do arquivo do repositório e não falha.
- Com o tema atualizado, as durações adotam 320 ms e 180 ms; componentes que usavam durações fixas passam a usar os tokens, e o teste de CSS confirma que não sobra duração fixa nos lugares trocados.
- Texto que não é URL vira busca no motor escolhido; URL continua navegando direto.
- Sem motor escolhido, a busca usa o Google.
- O modo navegador expande o painel direito e recolhe o chat para uma faixa; voltar restaura as larguras anteriores; o turno do chat não é interrompido.
- No backend, visitar uma página grava no histórico, o teto de itens é respeitado e a lista sai do mais recente para o mais antigo.
- Importar um CSV de senhas válido guarda as senhas criptografadas, e o arquivo não contém a senha em texto puro; importar HTML de favoritos e histórico popula as listas.
- Verificação manual com `npm run dev:app`: ícone na barra de tarefas, velocidade das animações, busca sem URL, modo navegador, histórico e importação.

## Out of Scope

- Preenchimento automático de senhas nos formulários das páginas.
- Extensões do Chrome e da Chrome Web Store.
- Trocar o motor do navegador (WebView2).
- Criar animações novas de entrada ou de saída de componentes.
- Terminais e o esforço no orquestrador, já entregues na branch `feat/terminal-abas-esforco`.
- Subagentes em segundo plano, que são outro trabalho.
- Publicação, push ou merge das branches.
- Trocar os arquivos de ícone de instalador em `src-tauri/icons/`.

## Further Notes

- O trabalho fica em três branches criadas a partir da main: `feat/icone-dev`, `feat/animacoes-globais` e `feat/navegador-modo`.
- A proteção de senhas ligada ao usuário do Windows usa a DPAPI; se a crate correspondente não estiver no projeto, uma dependência nova é adicionada e explicada antes de instalar.
- As ferramentas do agente no navegador (browser_read, browser_navigate e o servidor MCP) continuam pelo mesmo caminho de hoje.
- Fechar o app continua encerrando o que hoje é encerrado; nada disso muda.
- A verificação manual depende do app rodando com o backend do Tauri.
