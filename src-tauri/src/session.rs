use std::env;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStderr, ChildStdout, Command, ExitStatus, Stdio};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use crate::providers::{cli_args, cli_name, label, parse_line, stdin_input, ProviderEvent, ProviderKind, RunRequest};

/// Quantidade máxima de stderr guardada para mostrar ao usuário em caso de falha.
const STDERR_TAIL_BYTES: usize = 4096;

/// Processo filho de uma execução de CLI.
/// `pump` lê a saída numa thread; `cancel_handle` permite matar o processo de outra thread.
pub struct Session {
    child: Arc<Mutex<Child>>,
    stdout: Option<ChildStdout>,
    stderr: Option<JoinHandle<String>>,
}

/// Cópia leve para cancelar a execução sem precisar do `Session` inteiro.
#[derive(Clone)]
pub struct CancelHandle {
    child: Arc<Mutex<Child>>,
}

/// Comando sem janela de console. Sem isso, cada chamada ao CLI abre um console
/// no Windows quando o app roda como build de release.
pub(crate) fn hidden_command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut command = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

impl CancelHandle {
    /// Mata o processo e os filhos dele. No Windows, o `.cmd` do CLI roda via `cmd.exe`
    /// e o `node` real é neto; matar só o pai deixaria o pipe de stdout aberto.
    pub fn cancel(&self) -> std::io::Result<()> {
        let mut child = self.child.lock().expect("lock do processo");
        if cfg!(windows) {
            let status = hidden_command("taskkill")
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
    /// Inicia o CLI para a execução pedida e envia o prompt pelo stdin.
    pub fn start(request: &RunRequest) -> Result<Self, String> {
        Self::start_with_env(request, &[])
    }

    /// Como `start`, mas com variáveis de ambiente extras só para este processo (perfis de API).
    pub fn start_with_env(request: &RunRequest, env: &[(String, String)]) -> Result<Self, String> {
        let input = stdin_input(request)?;
        Self::spawn(
            request.provider,
            &input,
            cli_name(request.provider),
            cli_args(request),
            Some(&request.cwd),
            env,
        )
    }

    fn spawn(
        kind: ProviderKind,
        prompt: &str,
        program: &str,
        args: Vec<String>,
        cwd: Option<&Path>,
        env: &[(String, String)],
    ) -> Result<Self, String> {
        if let Some(dir) = cwd {
            if !dir.is_dir() {
                return Err(format!(
                    "a pasta de trabalho `{}` não existe. Escolha outra pasta.",
                    dir.display()
                ));
            }
        }

        let executable = resolve_program(program).ok_or_else(|| {
            format!(
                "não foi possível iniciar `{program}` ({}): executável não encontrado no PATH. Verifique se o CLI está instalado.",
                kind_label(kind)
            )
        })?;

        let mut command = hidden_command(&executable);
        command.args(&args);
        command.envs(env.iter().map(|(k, v)| (k.as_str(), v.as_str())));
        if let Some(dir) = cwd {
            command.current_dir(dir);
        }

        let mut child = command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
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

        // stderr é lido em thread própria; se ficasse sem leitura, o CLI travaria ao encher o pipe.
        let stdout = child.stdout.take();
        let stderr = child
            .stderr
            .take()
            .map(|pipe| std::thread::spawn(move || collect_stderr_tail(pipe)));
        Ok(Self {
            child: Arc::new(Mutex::new(child)),
            stdout,
            stderr,
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

    /// Espera o processo terminar e devolve o código de saída e o fim do stderr.
    pub fn finish(&mut self) -> std::io::Result<(ExitStatus, String)> {
        let status = self.child.lock().expect("lock do processo").wait()?;
        let stderr = self
            .stderr
            .take()
            .and_then(|handle| handle.join().ok())
            .unwrap_or_default();
        Ok((status, stderr))
    }
}

/// Lê o stderr até o fim, guardando só o trecho final.
fn collect_stderr_tail(mut pipe: ChildStderr) -> String {
    let mut tail: Vec<u8> = Vec::new();
    let mut chunk = [0u8; 1024];
    loop {
        match pipe.read(&mut chunk) {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                tail.extend_from_slice(&chunk[..n]);
                if tail.len() > STDERR_TAIL_BYTES {
                    let excess = tail.len() - STDERR_TAIL_BYTES;
                    tail.drain(..excess);
                }
            }
        }
    }
    String::from_utf8_lossy(&tail).trim().to_string()
}

/// Procura o executável no PATH e depois nas pastas dos instaladores oficiais (ver setup.rs).
/// No Windows, CLIs instalados via npm são shims `.cmd`, então `.exe` e `.cmd` também são testados.
pub(crate) fn resolve_program(program: &str) -> Option<PathBuf> {
    if Path::new(program).is_absolute() {
        return Path::new(program).is_file().then(|| PathBuf::from(program));
    }
    let path_dirs: Vec<PathBuf> = env::var_os("PATH").map(|value| env::split_paths(&value).collect()).unwrap_or_default();
    crate::setup::find(program, &path_dirs, &crate::setup::known_dirs())
}

/// Procura `program` em `dirs`. No Windows só aceita `.exe`, `.cmd` e `.bat`:
/// o nome sem extensão é um script sh instalado pelo npm, que o Windows não executa.
pub(crate) fn resolve_in(program: &str, dirs: &[PathBuf], windows: bool) -> Option<PathBuf> {
    let suffixes: &[&str] = if windows { &[".exe", ".cmd", ".bat"] } else { &[""] };

    dirs.iter().find_map(|dir| {
        suffixes
            .iter()
            .map(|suffix| dir.join(format!("{program}{suffix}")))
            .find(|candidate| candidate.is_file())
    })
}

fn kind_label(kind: ProviderKind) -> &'static str {
    label(kind)
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
            "{}\\tests\\fixtures\\claude_partial.jsonl",
            env!("CARGO_MANIFEST_DIR")
        );
        let mut session = Session::spawn(
            ProviderKind::Claude,
            "",
            "C:\\Windows\\System32\\cmd.exe",
            vec!["/C".into(), "type".into(), fixture],
            None,
            &[],
        )
        .expect("cmd.exe deve existir");

        let mut events = Vec::new();
        session.pump(ProviderKind::Claude, |e| events.push(e));
        session.finish().expect("processo deve terminar");

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
            None,
            &[],
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
        session.finish().expect("processo deve terminar após cancelamento");

        assert!(started.elapsed() < std::time::Duration::from_secs(30));
    }

    /// Regressão do A3: falha do CLI sem nenhuma saída em stdout. O motivo precisa vir do stderr
    /// e o código de saída precisa ser preservado.
    #[test]
    #[cfg(windows)]
    fn finish_reports_exit_code_and_stderr_on_failure() {
        let mut session = Session::spawn(
            ProviderKind::Claude,
            "",
            "C:\\Windows\\System32\\cmd.exe",
            vec!["/C".into(), "echo falhou 1>&2 & exit /b 3".into()],
            None,
            &[],
        )
        .expect("cmd.exe deve existir");

        let mut events = Vec::new();
        session.pump(ProviderKind::Claude, |e| events.push(e));
        let (status, stderr) = session.finish().expect("processo deve terminar");

        assert!(events.is_empty());
        assert_eq!(status.code(), Some(3));
        assert!(stderr.contains("falhou"), "stderr capturado: {stderr:?}");
    }

    /// Regressão do erro 193: npm instala `claude` (script sh), `claude.cmd` e `claude.ps1`
    /// na mesma pasta. A resolução precisa escolher o `.cmd`, nunca o script sem extensão.
    #[test]
    fn resolves_cmd_shim_over_extensionless_script() {
        let dir = std::env::temp_dir().join(format!("lunaharness-resolve-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("claude"), "#!/bin/sh\n").unwrap();
        std::fs::write(dir.join("claude.cmd"), "@ECHO off\r\n").unwrap();
        std::fs::write(dir.join("claude.ps1"), "# ps1\n").unwrap();

        let found = resolve_in("claude", std::slice::from_ref(&dir), true);

        assert_eq!(found, Some(dir.join("claude.cmd")));
    }

    /// Pasta de trabalho inexistente deve falhar antes de tentar abrir o CLI.
    #[test]
    fn rejects_workspace_that_does_not_exist() {
        let missing = std::env::temp_dir().join("lunaharness-pasta-que-nao-existe");
        let _ = std::fs::remove_dir_all(&missing);

        let result = Session::spawn(
            ProviderKind::Claude,
            "",
            "claude",
            vec![],
            Some(&missing),
            &[],
        );

        let message = result.err().expect("pasta inexistente deve ser recusada");
        assert!(message.contains("não existe"), "mensagem: {message}");
    }

    #[test]
    fn missing_cli_returns_readable_error() {
        let result = Session::spawn(
            ProviderKind::Codex,
            "",
            "comando-que-nao-existe-lunaharness",
            vec![],
            None,
            &[],
        );
        let message = match result {
            Ok(_) => panic!("não deveria iniciar um comando inexistente"),
            Err(e) => e,
        };
        assert!(message.contains("não foi possível iniciar"));
        assert!(message.contains("Codex"));
    }
}
