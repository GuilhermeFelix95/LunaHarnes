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
| `permissions` | Lista com `commands`, `hooks` e/ou `modes`. Outro valor recusa o plugin. |

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

### `registerMode(modo)`: permissão `modes`

Oferece um modo no composer, como chip ao lado de "Planejar". O modo é `{ id, label, description, instruction, permission: "readOnly" }`.

- `permission` **precisa** ser `"readOnly"`. Um modo só restringe: nunca dá mais permissão do que o composer já tem.
- Ligado, o modo roda o envio em só leitura e põe `instruction` na frente do pedido.
- Os modos são exclusivos: ligar um desliga o outro.

```js
export function activate(api) {
  api.registerMode({
    id: "ask",
    label: "Conversar",
    description: "Só explica, sem editar arquivos",
    instruction: "Responda só com explicações e perguntas. Não edite arquivos.",
    permission: "readOnly",
  });
}
```

## Marketplace

Em **Configurações > Plugins > Marketplace** você instala plugins de um catálogo.

- **Catálogo oficial:** embutido no app (`src-tauri/marketplace/official.json`). Funciona sem internet.
- **Catálogo por URL:** cole um endereço `https` de um `marketplace.json`. O app baixa e confere o catálogo antes de guardar a URL.

Formato do catálogo:

```json
{
  "name": "Meu catálogo",
  "plugins": [
    {
      "id": "ask-mode",
      "name": "Modo Conversar",
      "description": "Modo Conversar",
      "author": "Fulano",
      "version": "0.1.0",
      "entry": "index.js",
      "permissions": ["modes"],
      "files": [
        { "path": "manifest.json", "sha256": "<hash do conteúdo>", "url": "https://exemplo.com/ask-mode/manifest.json" },
        { "path": "index.js", "sha256": "<hash do conteúdo>", "content": "export function activate(api) { /* ... */ }" }
      ]
    }
  ]
}
```

Regras de instalação:

- Cada arquivo precisa de `sha256` (hash hexadecimal do conteúdo exato) e de **um** entre `content` (embutido) e `url` (https).
- Hash diferente do esperado recusa a instalação inteira.
- Limite de 1 MB por arquivo. Caminhos com `../` ou absolutos são recusados.
- A instalação grava numa pasta temporária e só depois troca pelo nome final. Um plugin que já existe não é sobrescrito: desinstale antes.
- Antes de instalar, o diálogo mostra as permissões pedidas.

Onde ficam as coisas (pasta de dados do app):

- pasta plugins/<id>/: cada plugin instalado.
- `plugins-state.json`: quais plugins estão desligados.
- `catalogs.json`: as URLs de catálogo adicionadas.

Desinstalar remove só a pasta daquele plugin. Ligar ou desligar vale a partir do próximo envio.

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
- Atualização automática de plugins instalados (reinstale pelo marketplace para atualizar).
- Assinatura de catálogos. O hash confere o conteúdo, mas não prova quem publicou.

## Exemplo

Veja `plugins-examples/hello-world/`.
