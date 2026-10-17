use std::env;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex};

use crate::providers::{cli_args, cli_name, parse_line, ProviderEvent, ProviderKind};

/// Processo filho de uma execução de CLI.
/// `pump` lê a saída numa thread; `cancel_handle` permite matar o processo de outra thread.
pub struct Session {
    child: Arc<Mutex<Child>>,
    stdout: Option<ChildStdout>,
}

/// Cópia leve para cancelar a execução sem precisar do `Session` inteiro.
#[derive(Clone)]
pub struct CancelHandle {
    child: Arc<Mutex<Child>>,
}

impl CancelHandle {
    /// Mata o processo e os filhos dele. No Windows, o `.cmd` do CLI roda via `cmd.exe`
    /// e o `node` real é neto; matar só o pai deixaria o pipe de stdout aberto.
    pub fn cancel(&self) -> std::io::Result<()> {
        let mut child = self.child.lock().expect("lock do processo");
        if cfg!(windows) {
            let status = Command::new("taskkill")
                .args(["/PID", &child.id().to_string(), "/T", "/F"])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()?;
            if status.success() {
                return Ok(());
            }
        }
        child.kill()
    }
}

impl Session {
    /// Inicia o CLI do provedor e envia o prompt pelo stdin.
    pub fn start(kind: ProviderKind, prompt: &str) -> Result<Self, String> {
        Self::spawn(kind, prompt, cli_name(kind), cli_args(kind))
    }

    fn spawn(
        kind: ProviderKind,
        prompt: &str,
        program: &str,
        args: Vec<String>,
    ) -> Result<Self, String> {
        let executable = resolve_program(program).ok_or_else(|| {
            format!(
                "não foi possível iniciar `{program}` ({}): executável não encontrado no PATH. Verifique se o CLI está instalado.",
                kind_label(kind)
            )
        })?;

        let mut child = Command::new(&executable)
            .args(&args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| {
                format!(
                    "não foi possível iniciar `{program}` ({}): {e}.",
                    kind_label(kind)
                )
            })?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(prompt.as_bytes())
                .map_err(|e| format!("falha ao enviar prompt para {}: {e}", kind_label(kind)))?;
        }

        let stdout = child.stdout.take();
        Ok(Self {
            child: Arc::new(Mutex::new(child)),
            stdout,
        })
    }

    pub fn cancel_handle(&self) -> CancelHandle {
        CancelHandle {
            child: Arc::clone(&self.child),
        }
    }

    /// Lê o stdout linha a linha, traduz para eventos e chama `on_event`.
    /// Bloqueia até o processo fechar a saída.
    pub fn pump(&mut self, kind: ProviderKind, mut on_event: impl FnMut(ProviderEvent)) {
        let Some(stdout) = self.stdout.take() else {
            on_event(ProviderEvent::Error {
                message: "stdout do processo indisponível".into(),
            });
            return;
        };

        for line in BufReader::new(stdout).lines() {
            match line {
                Ok(line) if line.trim().is_empty() => {}
                Ok(line) => parse_line(kind, &line).into_iter().for_each(&mut on_event),
                Err(e) => {
                    on_event(ProviderEvent::Error {
                        message: format!("erro ao ler saída de {}: {e}", kind_label(kind)),
                    });
                    break;
                }
            }
        }
    }

    pub fn wait(&mut self) -> std::io::Result<std::process::ExitStatus> {
        self.child.lock().expect("lock do processo").wait()
    }
}

/// Procura o executável no PATH. No Windows, CLIs instalados via npm são shims
/// `.cmd`, então as extensões `.exe` e `.cmd` também são testadas.
pub(crate) fn resolve_program(program: &str) -> Option<PathBuf> {
    if Path::new(program).is_absolute() {
        return Path::new(program).is_file().then(|| PathBuf::from(program));
    }

    let suffixes: &[&str] = if cfg!(windows) {
        &["", ".exe", ".cmd"]
    } else {
        &[""]
    };
    let dirs = env::var_os("PATH")?;

    env::split_paths(&dirs).find_map(|dir| {
        suffixes
            .iter()
            .map(|suffix| dir.join(format!("{program}{suffix}")))
            .find(|candidate| candidate.is_file())
    })
}

fn kind_label(kind: ProviderKind) -> &'static str {
    match kind {
        ProviderKind::Claude => "Claude Code",
        ProviderKind::Codex => "Codex",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Simula um CLI que imprime um arquivo de fixture, para testar o pipeline
    /// spawn -> stdout -> parser sem depender de conta ou rede.
    #[test]
    #[cfg(windows)]
    fn pipeline_reads_fixture_from_process_stdout() {
        let fixture = format!(
            "{}\\tests\\fixtures\\claude_stream.jsonl",
            env!("CARGO_MANIFEST_DIR")
        );
        let mut session = Session::spawn(
            ProviderKind::Claude,
            "",
            "C:\\Windows\\System32\\cmd.exe",
            vec!["/C".into(), "type".into(), fixture],
        )
        .expect("cmd.exe deve existir");

        let mut events = Vec::new();
        session.pump(ProviderKind::Claude, |e| events.push(e));
        session.wait().expect("processo deve terminar");

        assert!(events.contains(&ProviderEvent::TextDelta { text: "ok".into() }));
        assert_eq!(events.last(), Some(&ProviderEvent::Done { ok: true }));
    }

    #[test]
    #[cfg(windows)]
    fn cancel_stops_a_running_process() {
        let mut session = Session::spawn(
            ProviderKind::Claude,
            "",
            "C:\\Windows\\System32\\cmd.exe",
            vec!["/C".into(), "ping".into(), "-n".into(), "60".into(), "127.0.0.1".into()],
        )
        .expect("cmd.exe deve existir");

        let handle = session.cancel_handle();
        let canceller = std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(300));
            handle.cancel().expect("cancelamento deve funcionar");
        });

        let started = std::time::Instant::now();
        session.pump(ProviderKind::Claude, |_| {});
        canceller.join().unwrap();
        session.wait().expect("processo deve terminar após cancelamento");

        assert!(started.elapsed() < std::time::Duration::from_secs(30));
    }

    #[test]
    fn missing_cli_returns_readable_error() {
        let result = Session::spawn(
            ProviderKind::Codex,
            "",
            "comando-que-nao-existe-lunaharness",
            vec![],
        );
        let message = match result {
            Ok(_) => panic!("não deveria iniciar um comando inexistente"),
            Err(e) => e,
        };
        assert!(message.contains("não foi possível iniciar"));
        assert!(message.contains("Codex"));
    }
}
