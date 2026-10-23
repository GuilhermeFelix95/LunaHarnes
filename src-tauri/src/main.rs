// Evita a janela de console extra no Windows em builds de release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // `lunacode mcp add|remove ...` roda no terminal, sem abrir a janela (usado por `luna mcp add`).
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("mcp") {
        std::process::exit(lunacode::mcp::cli(&args[2..]));
    }
    // `lunacode browser-mcp` é o servidor MCP do navegador: o Claude o inicia e fala por stdin/stdout.
    if args.get(1).map(String::as_str) == Some("browser-mcp") {
        std::process::exit(lunacode::browser::mcp_stdio());
    }
    // `lunacode tasks-mcp` é o servidor de etapas para o OpenCode e o Codex (stdin/stdout).
    if args.get(1).map(String::as_str) == Some("tasks-mcp") {
        std::process::exit(lunacode::tasks_mcp::mcp_stdio());
    }
    // `lunacode permission-mcp` é o servidor de pedidos de permissão do Claude (`--permission-prompt-tool`).
    if args.get(1).map(String::as_str) == Some("permission-mcp") {
        std::process::exit(lunacode::permission_prompt::mcp_stdio());
    }
    lunacode::migrate::run();
    lunacode::run();
}
