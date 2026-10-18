/// Nome curto para mostrar no seletor: o último trecho do id ("nvidia/nemotron-3.5-super-vl:free" -> "nemotron-3.5-super-vl:free").
/// O id completo continua sendo o que vai para a API.
export function shortModelName(id: string): string {
  const parts = id.split("/");
  return parts[parts.length - 1] || id;
}
