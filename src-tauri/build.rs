fn main() {
    tauri_build::build();
    // Os testes unitários da lib linkam a webview (navegador integrado), que usa comctl32 v6.
    // Cargo ignora `rustc-link-arg-tests` nesses testes, então a dependência vai para todo alvo do Windows.
    // O executável do app já declara a mesma dependência pelo tauri_build, então a duplicata é inofensiva.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        println!(
            "cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'"
        );
    }
}
