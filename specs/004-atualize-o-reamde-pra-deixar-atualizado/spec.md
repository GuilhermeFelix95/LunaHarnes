# Spec: permissões com pedido de confirmação, velocidade real e diff no chat

## Problem Statement

O seletor de permissões do composer tem três opções com nomes que não dizem o que cada uma faz. `Aceitar edições` deixa o agente escrever arquivos sem perguntar, mas não explica que ações sensíveis, como comandos, ainda exigem atenção. Quem usa não consegue aprovar uma ação sensível pelo chat, como no Claude Code.

A velocidade mostrada durante a resposta é uma estimativa por quantidade de caracteres, não a velocidade real do modelo. Ela engana quem quer saber quão rápido o agente está respondendo.

As alterações de arquivo aparecem só como uma linha de ação, sem o conteúdo alterado. Para ver o que mudou, a pessoa precisa abrir outro painel.

## Solution

O seletor passa a ter `Só leitura`, `Pedir permissão` e `Acesso total`. Em `Pedir permissão`, o agente pode executar tarefas, mas ações sensíveis abrem um pedido de confirmação no próprio chat, com as opções Permitir, Negar e Sempre nesta conversa. Nos motores que não têm esse canal de aprovação, `Pedir permissão` funciona como `Só leitura`.

`Acesso total` passa a ser o padrão para conversas novas. Conversas já salvas mantêm a permissão que tinham.

A velocidade passa a ser medida a partir da contagem real de tokens de saída. No Claude, ela é atualizada ao vivo durante a resposta. Nos demais motores, aparece o valor final do turno, quando a CLI informa essa contagem.

As edições de arquivo ganham um diff inline, recolhível, com a quantidade de linhas adicionadas e removidas, dentro da ação correspondente no chat.

## User Stories

1. Como usuário, quero escolher `Pedir permissão` para que o agente execute tarefas e me peça confirmação antes de ações sensíveis.
2. Como usuário, quero aprovar ou negar uma ação sensível pelo pop-up no chat, para decidir na hora.
3. Como usuário, quero escolher para a conversa inteira que uma ação seja sempre permitida, sem ver o pop-up de novo.
4. Como usuário, quero que `Acesso total` seja o padrão em conversas novas, para não ser interrompido.
5. Como usuário, quero que conversas antigas mantenham a permissão que já tinham, para não ver mudanças inesperadas no que já uso.
6. Como usuário, quero que `Só leitura` impeça qualquer escrita de arquivo, para ter certeza de que nada será alterado.
7. Como usuário, quero, num motor sem pop-up, que `Pedir permissão` se comporte como `Só leitura`, e que isso fique visível para mim.
8. Como usuário, quero ver a velocidade real da resposta durante a geração, para saber quão rápido o agente está respondendo.
9. Como usuário, quero ver a velocidade final do turno quando o motor não permite medição ao vivo, em vez de um valor estimado.
10. Como usuário, quero que a velocidade apareça como "sem dados" quando o motor não informa a contagem de tokens, nunca como um número inventado.
11. Como usuário, quero ver, para cada arquivo editado, o que foi removido e o que foi adicionado, sem sair do chat.
12. Como usuário, quero recolher ou expandir o diff de cada edição, para manter a conversa legível.
13. Como usuário, quero ver quantas linhas foram adicionadas e removidas em cada edição, no próprio cabeçalho do diff.

## Implementation Decisions

- O seletor tem três opções, na ordem `Só leitura`, `Pedir permissão` e `Acesso total`. O nome `Pedir permissão` substitui `Aceitar edições` na interface; o valor interno guardado nas conversas salvas não muda.
- `Acesso total` é o padrão para conversas novas. Conversas salvas mantêm a permissão que tinham.
- No Claude, `Pedir permissão` usa o mecanismo de permissão da própria CLI: as solicitações chegam ao app por uma ferramenta do próprio executável, que responde allow ou deny conforme a escolha da pessoa.
- A ferramenta de permissão é um servidor de contexto do próprio app, no mesmo padrão do navegador embutido e das tarefas.
- Nos motores sem canal de aprovação interativo, `Pedir permissão` equivale a `Só leitura`. A troca de comportamento aparece para a pessoa antes do envio.
- Motores que só rodam com acesso total continuam sem seletor de permissão.
- A velocidade é calculada com tokens de saída informados pela CLI, dividido pelo tempo desde o primeiro token até o fim da resposta.
- No Claude, a contagem de saída chega durante a resposta, e a velocidade é atualizada ao vivo. Nos motores sem essa informação durante a resposta, a velocidade só aparece ao fim do turno.
- Quando a CLI não informa a contagem de tokens de saída, a velocidade aparece como "sem dados".
- A estimativa por caracteres sai da interface.
- O diff é montado a partir do conteúdo que a própria ferramenta de edição recebeu, sem reler o arquivo do disco.
- O diff mostra cada arquivo editado, com linhas removidas e adicionadas, e a contagem de +N e −M no cabeçalho.
- Diffs longos mostram um número limitado de linhas, com o restante recolhido e uma forma de expandir.
- A aba Alterações continua como está; o diff inline é complementar.
- Os textos novos existem em português e inglês.
- Não há mudança na API pública de plugins: o modo `readOnly` continua igual.

## Testing Decisions

Os testes verificam só o comportamento externo: o que a pessoa e o plugin observam.

- Com `Só leitura`, nenhuma escrita de arquivo acontece, em nenhum motor.
- Com `Pedir permissão` no Claude, uma ação sensível abre o pedido no chat e espera a decisão.
- Permitir executa a ação. Negar impede a ação, e o agente recebe a negativa.
- `Sempre nesta conversa` permite as ações seguintes da mesma conversa sem novo pedido.
- Num motor sem canal de aprovação, `Pedir permissão` não abre pedido e não escreve arquivos.
- Uma conversa nova começa em `Acesso total`.
- Uma conversa salva mantém a permissão que tinha.
- Durante a resposta do Claude, a velocidade muda conforme a contagem de saída chega.
- Ao fim do turno, cada motor mostra o valor final quando a informação existe.
- Quando a informação não existe, aparece "sem dados", e não um número.
- Uma edição mostra o diff recolhível com o número certo de linhas adicionadas e removidas.
- Um diff longo mostra só um trecho até a pessoa expandir.
- Edições de arquivo novo, de substituição e de várias partes aparecem como diff.

## Out of Scope

- Pedido de permissão em motores que não têm canal de aprovação interativo.
- Mudança na aba Alterações.
- Migração do valor interno das conversas salvas.
- Velocidade medida ao vivo em motores que só informam a contagem no fim.
- Mudança na API de plugins.
- Atualização dos READMEs em outros idiomas.

## Further Notes

- O formato da ferramenta de permissão do Claude CLI deve ser validado com a CLI real antes da implementação da interface. A documentação oficial confirma a flag, mas não o formato completo da ferramenta.
- Conversas salvas com a permissão antiga passam a pedir confirmação quando usam `Pedir permissão`. Isso é uma mudança de comportamento para quem já tem essas conversas.
- `Acesso total` como padrão em conversas novas aumenta o risco de ações sem confirmação. É uma escolha explícita do usuário.
