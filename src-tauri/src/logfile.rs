//! Registro de erros em arquivo (`luna.log`, na pasta de logs do app). Grava só a mensagem que o código já mostra,
//! uma linha por erro. Sem dados sensíveis: quem monta a mensagem é responsável por não colocar senhas nem conversas.
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

const FILE_NAME: &str = "luna.log";
const OLD_NAME: &str = "luna.old.log";
/// Passou disso, o arquivo atual vira `luna.old.log` e um novo começa.
const MAX_BYTES: u64 = 1024 * 1024;

static PATH: OnceLock<PathBuf> = OnceLock::new();

/// Liga o registro à pasta de logs. Chamado uma vez, no início do app.
pub fn start(dir: &Path) {
    let _ = fs::create_dir_all(dir);
    let _ = PATH.set(dir.join(FILE_NAME));
}

/// Uma linha: segundos desde 1970 (UTC), o nível e a mensagem, sem quebras de linha.
pub fn format_line(unix_secs: u64, message: &str) -> String {
    format!("{unix_secs} ERRO {}\n", message.replace(['\r', '\n'], " "))
}

/// Mostra o erro no terminal e, se o registro estiver ligado, grava no arquivo.
pub fn error(message: &str) {
    eprintln!("{message}");
    let Some(path) = PATH.get() else { return };
    if fs::metadata(path).map(|m| m.len() > MAX_BYTES).unwrap_or(false) {
        let _ = fs::rename(path, path.with_file_name(OLD_NAME));
    }
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = file.write_all(format_line(secs, message).as_bytes());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_error_is_one_line_with_time_and_message() {
        let line = format_line(1_700_000_000, "não foi possível gravar o guia\nem C:\\pasta");

        assert_eq!(line, "1700000000 ERRO não foi possível gravar o guia em C:\\pasta\n");
        assert_eq!(line.matches('\n').count(), 1);
    }
}
