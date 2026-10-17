//! Terminal embutido: um shell por sessão, num pseudo-terminal (ConPTY no Windows).
//! A saída vai para o frontend pelo evento `terminal-data`; o fim do shell, por `terminal-exit`.
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::Mutex;
use std::thread;

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;

use crate::session::resolve_program;

pub const DATA_EVENT: &str = "terminal-data";
pub const EXIT_EVENT: &str = "terminal-exit";

const MAX_DIMENSION: u16 = 500;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalData {
    pub id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalExit {
    pub id: String,
}

/// Uma sessão de terminal viva.
pub struct Terminal {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

impl Terminal {
    pub fn write(&mut self, data: &str) -> Result<(), String> {
        self.writer
            .write_all(data.as_bytes())
            .and_then(|_| self.writer.flush())
            .map_err(|e| format!("não foi possível enviar a entrada ao terminal: {e}"))
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        self.master
            .resize(size(cols, rows)?)
            .map_err(|e| format!("não foi possível redimensionar o terminal: {e}"))
    }

    pub fn kill(&mut self) {
        // Se o shell já terminou, kill falha; não há o que fazer.
        let _ = self.child.kill();
    }
}

/// Todos os terminais abertos, por id.
#[derive(Default)]
pub struct Terminals(pub Mutex<HashMap<String, Terminal>>);

/// Shell padrão do Windows: PowerShell 7 se existir, senão o Windows PowerShell.
pub fn shell_command() -> Result<CommandBuilder, String> {
    let shell = resolve_program("pwsh")
        .or_else(|| resolve_program("powershell"))
        .ok_or("PowerShell não encontrado no PATH.")?;
    let mut command = CommandBuilder::new(shell);
    command.arg("-NoLogo");
    Ok(command)
}

fn size(cols: u16, rows: u16) -> Result<PtySize, String> {
    if cols == 0 || rows == 0 || cols > MAX_DIMENSION || rows > MAX_DIMENSION {
        return Err(format!("tamanho de terminal inválido: {cols}x{rows}"));
    }
    Ok(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    })
}

/// Abre o programa num PTY, na pasta dada. `on_data` recebe a saída; `on_exit` roda quando ela termina.
pub fn spawn(
    mut command: CommandBuilder,
    cwd: &Path,
    cols: u16,
    rows: u16,
    on_data: impl Fn(String) + Send + 'static,
    on_exit: impl FnOnce() + Send + 'static,
) -> Result<Terminal, String> {
    if !cwd.is_dir() {
        return Err(format!("a pasta do terminal não existe: {}", cwd.display()));
    }
    let pair = native_pty_system()
        .openpty(size(cols, rows)?)
        .map_err(|e| format!("não foi possível abrir o pseudo-terminal: {e}"))?;

    command.cwd(cwd);
    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|e| format!("não foi possível iniciar o shell: {e}"))?;
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("não foi possível ler o terminal: {e}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("não foi possível escrever no terminal: {e}"))?;

    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut pending = Vec::new();
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    pending.extend_from_slice(&buf[..n]);
                    let text = take_utf8(&mut pending);
                    if !text.is_empty() {
                        on_data(text);
                    }
                }
            }
        }
        on_exit();
    });

    Ok(Terminal {
        master: pair.master,
        writer,
        child,
    })
}

/// Separa o texto completo do que ainda é um caractere UTF-8 cortado entre duas leituras.
pub fn take_utf8(pending: &mut Vec<u8>) -> String {
    match std::str::from_utf8(pending) {
        Ok(text) => {
            let out = text.to_string();
            pending.clear();
            out
        }
        Err(e) if e.error_len().is_none() => {
            // Sequência incompleta no fim: guarda para a próxima leitura.
            let valid = e.valid_up_to();
            let out = String::from_utf8_lossy(&pending[..valid]).into_owned();
            pending.drain(..valid);
            out
        }
        Err(_) => {
            let out = String::from_utf8_lossy(pending).into_owned();
            pending.clear();
            out
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    #[test]
    fn utf8_split_across_reads_is_kept_for_the_next_chunk() {
        // "é" é C3 A9; a primeira leitura trouxe só o C3.
        let mut pending = vec![b'a', 0xC3];
        assert_eq!(take_utf8(&mut pending), "a");
        assert_eq!(pending, vec![0xC3]);

        pending.push(0xA9);
        assert_eq!(take_utf8(&mut pending), "é");
        assert!(pending.is_empty());
    }

    #[test]
    fn invalid_bytes_are_replaced_not_kept_forever() {
        let mut pending = vec![0xFF, b'x'];
        assert_eq!(take_utf8(&mut pending), "\u{FFFD}x");
        assert!(pending.is_empty());
    }

    #[test]
    fn rejects_sizes_outside_the_allowed_range() {
        assert!(size(0, 24).is_err());
        assert!(size(80, 0).is_err());
        assert!(size(501, 24).is_err());
        assert!(size(120, 30).is_ok());
    }

    #[test]
    fn rejects_a_working_folder_that_does_not_exist() {
        let missing = std::env::temp_dir().join("lunaharness-sem-essa-pasta-xyz");
        let mut command = CommandBuilder::new("cmd");
        command.arg("/C");

        let result = spawn(command, &missing, 80, 24, |_| {}, || {});

        assert!(result.is_err());
    }

    /// Roda um comando real no PTY e confere que a saída chega ao callback.
    #[test]
    fn runs_a_command_in_a_pty_and_streams_its_output() {
        let (tx, rx) = mpsc::channel::<String>();
        let mut command = CommandBuilder::new("cmd");
        command.arg("/C");
        command.arg("echo luna-ok");

        let mut terminal = spawn(command, &std::env::temp_dir(), 80, 24, move |text| {
            let _ = tx.send(text);
        }, || {})
        .expect("o pseudo-terminal deve abrir");

        let mut seen = String::new();
        let deadline = std::time::Instant::now() + Duration::from_secs(15);
        while !seen.contains("luna-ok") && std::time::Instant::now() < deadline {
            if let Ok(chunk) = rx.recv_timeout(Duration::from_millis(200)) {
                // O ConPTY pergunta a posição do cursor (ESC[6n) e espera a resposta. O xterm.js
                // responde sozinho no app; aqui a resposta é simulada.
                if chunk.contains("\u{1b}[6n") {
                    terminal.write("\u{1b}[1;1R").expect("resposta ao cursor");
                }
                seen.push_str(&chunk);
            }
        }
        terminal.kill();

        assert!(seen.contains("luna-ok"), "saída do PTY: {seen:?}");
    }
}
