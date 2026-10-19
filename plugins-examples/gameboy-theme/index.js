// Plugin de exemplo: deixa o Luna com a cara de um Game Boy (quatro verdes, cantos retos, fonte monoespaçada).
// Copie esta pasta para <app_data>/plugins/gameboy-theme e escolha o tema em Configurações > Aparência.

export function activate(api) {
  api.theme.register({
    id: "gameboy",
    name: "Game Boy",
    dark: false,
    tokens: {
      "--bg": "#9bbc0f",
      "--bg-sidebar": "#8bac0f",
      "--surface": "#8bac0f",
      "--fg": "#0f380f",
      "--fg-muted": "#306230",
      "--border": "#306230",
    },
    css: `
      * { border-radius: 0 !important; }
      body { font-family: monospace !important; }
    `,
  });
}
