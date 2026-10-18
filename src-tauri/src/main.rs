// Evita a janela de console extra no Windows em builds de release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // `lunaharness mcp add|remove ...` roda no terminal, sem abrir a janela (usado por `luna mcp add`).
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("mcp") {
        std::process::exit(lunaharness::mcp::cli(&args[2..]));
    }
    lunaharness::run();
}
