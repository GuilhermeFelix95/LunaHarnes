# Campo de mensagem sem cortar caracteres nos formatos de tema

## Problem Statement

Quando o usuário escolhe um formato de tema com bordas muito arredondadas ou assimétricas, o campo de mensagem do chat corta as primeiras letras nas bordas. Caracteres não deveriam ser cortados nunca, em nenhum formato. Hoje o campo herda o raio do formato sem espaço interno suficiente, então o texto encosta na curva e some.

## Solution

O campo de mensagem do chat ganha um espaço interno horizontal e um raio próprio limitado, independente do formato. A moldura externa do composer continua seguindo o formato escolhido. Palavras só quebram entre espaços; uma palavra longa, como uma URL ou um trecho de código, rola na horizontal dentro do campo.

## User Stories

1. Como usuário, quero que o texto que digito no campo de mensagem nunca seja cortado nas bordas, para ler e revisar o que escrevi.
2. Como usuário, quero que essa correção valha para todos os formatos de tema, para não ter que trocar de formato para escrever.
3. Como usuário, quero que a moldura do composer continue com a aparência do formato que escolhi, para não perder a identidade visual.
4. Como usuário, quero que uma URL ou um trecho de código longo não quebre no meio da palavra, para conseguir lê-lo inteiro.
5. Como usuário, quero continuar vendo claramente onde o campo está em foco, mesmo com o contorno de foco mudado.

## Implementation Decisions

- O frontend é React com TypeScript. Os estilos são arquivos CSS do próprio projeto, sem framework de estilos.
- A correção fica restrita ao campo de mensagem do chat. Os outros campos de texto do aplicativo (configurações, editor, buscas) mantêm o comportamento atual.
- O raio do campo de mensagem tem teto de 12px. Quando o formato pede um raio menor, o menor valor vale.
- A moldura do composer mantém o raio do formato escolhido.
- A quebra de linha acontece só entre palavras. Palavras longas não são quebradas no meio.
- O contorno de foco padrão do campo de mensagem é removido. O destaque de foco passa a ser a borda da moldura do composer.
- A definição dos formatos de tema não muda.
- Testes automatizados usam Vitest e leem a folha de estilo do composer.

## Testing Decisions

Os testes verificam só o comportamento externo: o que o usuário vê e o que a folha de estilo define para o campo.

- Em cada um dos 13 formatos de tema, o campo de mensagem tem espaço interno horizontal e raio de no máximo 12px.
- Em cada um dos 13 formatos, a moldura do composer continua usando o raio do formato escolhido.
- O campo de mensagem quebra linhas só entre palavras, sem quebrar palavras no meio.
- Verificação visual manual nos formatos Pílula, Bolha, Gota, Pedra e Quadrado, com texto longo e uma URL longa: nenhum caractere cortado, URL rola na horizontal, foco visível na moldura.
- Campos de texto fora do composer não são alterados; isso é verificado pela ausência de mudanças nesses componentes.

## Out of Scope

- Correção em outros componentes com corte nas bordas, como chips e bolhas de mensagem. Se aparecerem, são listados como pendência.
- Alteração dos formatos de tema e da forma como eles são calculados.
- Mudança no campo de texto das configurações, do editor e das buscas.
- Cache de prompt, taxa de acerto do cache e plugin Cache de Tokens: são outra tarefa.
- Publicação, push ou merge da branch.

## Further Notes

- A branch de trabalho é fix/campo-texto-formatos, criada a partir de main.
- A remoção do contorno de foco do campo muda a acessibilidade de teclado do campo; o destaque na moldura compensa essa mudança.
- Diferenças de renderização entre navegadores não são cobertas pelos testes automatizados; a verificação visual cobre o caso principal.
