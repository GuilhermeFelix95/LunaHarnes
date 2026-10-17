# Plugins do LunaHarness

Um plugin é uma pasta com dois arquivos: um manifesto e um módulo JavaScript (ES module).

## Onde instalar

Copie a pasta do plugin para a pasta de dados do app:

```
%APPDATA%\dev.lunaharness.app\plugins\<id-do-plugin>\
```

O nome da pasta **precisa ser igual** ao `id` do manifesto.

## Manifesto (`manifest.json`)

```json
{
  "id": "hello-world",
  "name": "Hello World",
  "version": "0.1.0",
  "entry": "index.js",
  "permissions": ["commands", "hooks"]
}
```

| Campo | Regra |
|---|---|
| `id` | Letras minúsculas, números e hífen. Não pode começar com hífen. Máximo de 64 caracteres. |
| `name` | Obrigatório, não pode ser vazio. |
| `version` | Texto livre (recomendado: semver). |
| `entry` | Caminho relativo dentro da pasta do plugin. Não pode sair dela (`../` é recusado). |
| `permissions` | Lista com `commands` e/ou `hooks`. Outro valor recusa o plugin. |

Um plugin inválido aparece na lista de avisos do app e não impede os outros de carregar.

## Código do plugin

O módulo precisa exportar `activate(api)`. Ele é chamado uma vez, na inicialização do app.

```js
export function activate(api) {
  api.registerCommand("ola", (args) => `Cumprimente ${args} em uma frase.`);
  api.onBeforeSend((prompt) => `Responda em português.\n\n${prompt}`);
}
```

## API disponível

### `registerCommand(nome, handler)`: permissão `commands`

Registra `/nome` no chat. `nome` usa letras minúsculas, números e hífen, e não pode repetir um comando já existente.

O `handler` recebe o texto depois do comando:

- Se devolver uma **string**, ela é enviada ao provedor como o pedido.
- Se devolver **nada**, o comando só executa uma ação local.

### `onBeforeSend(hook)`: permissão `hooks`

Roda antes de cada envio, na ordem em que os plugins foram carregados. Se o hook devolver uma string, ela substitui o texto a ser enviado. Se devolver nada, o texto segue sem alteração.

Comandos também passam por esse hook, sobre o texto que o comando gerou.

### `onAfterResponse(hook)`: permissão `hooks`

Recebe o texto completo da resposta quando ela termina. Não altera a resposta exibida.

## Erros

Se a ativação ou um hook falhar, a mensagem aparece na lista de avisos do chat, com o nome do plugin. Os demais plugins continuam funcionando.

## Limites de segurança (leia antes de instalar um plugin)

As permissões são **controle da API oferecida ao plugin**, não uma barreira de segurança. O código do plugin roda na mesma janela do app e pode, em tese, chamar qualquer recurso que a janela já tenha. Por isso:

- instale só plugins cujo código você leu ou confia;
- não espere que a lista de permissões limite o que o código faz de fato.

Um sandbox real (WASM ou processo isolado) está previsto para depois do MVP.

## Fora do MVP

- Painéis de interface (`registerPanel`).
- Permissões de sistema de arquivos e rede.
- Instalação e atualização pelo próprio app.

## Exemplo

Veja `plugins-examples/hello-world/`.
