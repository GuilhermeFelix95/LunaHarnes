//! Tarefas em segundo plano: execuções próprias do Claude CLI, iniciadas pelo app,
//! que continuam depois do fim do turno do chat. Cada tarefa tem id, status e saída,
//! e pode ser parada pelo usuário enquanto roda.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};

use crate::providers::{claude, Permission, ProviderEvent, ProviderKind};
use crate::session::{CancelHandle, Session};

/// Quantidade máxima de tarefas rodando ao mesmo tempo.
pub const MAX_BACKGROUND_TASKS: usize = 3;

/// Nome do evento que o frontend escuta (espelha `BACKGROUND_TASK_EVENT` em src/api.ts).
pub const TASK_EVENT: &str = "background-task";

/// Contador para ids distintos dentro do mesmo milissegundo.
static NEXT_TASK: AtomicU64 = AtomicU64::new(1);

/// Estado da tarefa. `Running` enquanto o processo existe; os outros são finais.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Running,
    Done,
    Failed,
    Stopped,
}

/// Uma tarefa como o frontend a vê. A saída é o texto que o agente produziu.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundTask {
    pub id: String,
    pub prompt: String,
    pub status: TaskStatus,
    pub output: String,
    /// Conversa que pediu a tarefa: a lista e o resultado ficam só nela.
    pub conversation_id: String,
}

/// Registro das tarefas em segundo plano do app, gerenciado pelo Tauri.
#[derive(Default)]
pub struct BackgroundTasks(pub Mutex<Board>);

#[derive(Default)]
pub struct Board {
    tasks: Vec<Entry>,
}

struct Entry {
    task: BackgroundTask,
    cancel: Option<CancelHandle>,
}

impl Board {
    fn running(&self) -> usize {
        self.tasks.iter().filter(|entry| entry.task.status == TaskStatus::Running).count()
    }

    /// Reserva uma vaga para a tarefa. Acima do limite, devolve a mensagem que o usuário vê.
    pub fn reserve(&mut self, id: &str, prompt: &str, conversation_id: &str) -> Result<(), String> {
        if self.tasks.iter().any(|entry| entry.task.id == id) {
            return Err(format!("já existe uma tarefa em segundo plano com o id `{id}`"));
        }
        if self.running() >= MAX_BACKGROUND_TASKS {
            return Err(format!(
                "já há {MAX_BACKGROUND_TASKS} tarefas em segundo plano rodando; pare uma antes de iniciar outra"
            ));
        }
        self.tasks.push(Entry {
            task: BackgroundTask {
                id: id.to_string(),
                prompt: prompt.to_string(),
                status: TaskStatus::Running,
                output: String::new(),
                conversation_id: conversation_id.to_string(),
            },
            cancel: None,
        });
        Ok(())
    }

    /// Liga o processo reservado à tarefa, para que ela possa ser parada.
    pub fn attach(&mut self, id: &str, cancel: CancelHandle) {
        if let Some(entry) = self.tasks.iter_mut().find(|entry| entry.task.id == id) {
            entry.cancel = Some(cancel);
        }
    }

    /// Para uma tarefa em andamento. Tarefa inexistente é erro com mensagem clara.
    pub fn stop(&mut self, id: &str) -> Result<BackgroundTask, String> {
        let entry = self
            .tasks
            .iter_mut()
            .find(|entry| entry.task.id == id)
            .ok_or_else(|| format!("tarefa em segundo plano `{id}` não encontrada"))?;
        if entry.task.status != TaskStatus::Running {
            return Ok(entry.task.clone());
        }
        // Sem processo ligado, marcar "parada" deixaria o CLI rodando e gastando tokens.
        let cancel = entry
            .cancel
            .as_ref()
            .ok_or_else(|| format!("a tarefa em segundo plano `{id}` ainda está iniciando; tente parar em instantes"))?;
        cancel.cancel().map_err(|e| format!("não foi possível parar a tarefa `{id}`: {e}"))?;
        entry.task.status = TaskStatus::Stopped;
        Ok(entry.task.clone())
    }

    /// Fecha a tarefa quando o processo termina. Tarefa parada continua parada.
    pub fn finish(&mut self, id: &str, ok: bool, output: String) -> Option<BackgroundTask> {
        let entry = self.tasks.iter_mut().find(|entry| entry.task.id == id)?;
        if entry.task.status != TaskStatus::Running {
            return None;
        }
        entry.task.status = if ok { TaskStatus::Done } else { TaskStatus::Failed };
        entry.task.output = output;
        Some(entry.task.clone())
    }

    /// Todas as tarefas, na ordem em que foram criadas.
    pub fn list(&self) -> Vec<BackgroundTask> {
        self.tasks.iter().map(|entry| entry.task.clone()).collect()
    }

    /// Tarefas de uma conversa, na ordem em que foram criadas.
    pub fn of_conversation(&self, conversation_id: &str) -> Vec<BackgroundTask> {
        self.tasks
            .iter()
            .filter(|entry| entry.task.conversation_id == conversation_id)
            .map(|entry| entry.task.clone())
            .collect()
    }

    /// Encerra as tarefas ao fechar o app: nenhum processo fica órfão.
    pub fn stop_all(&mut self) {
        for entry in &mut self.tasks {
            if entry.task.status == TaskStatus::Running {
                if let Some(cancel) = &entry.cancel {
                    let _ = cancel.cancel();
                }
                entry.task.status = TaskStatus::Stopped;
            }
        }
    }
}

fn new_task_id() -> String {
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis())
        .unwrap_or(0);
    format!("bg-{millis}-{}", NEXT_TASK.fetch_add(1, Ordering::Relaxed))
}

/// Inicia uma tarefa em segundo plano no Claude. Devolve já com o id para a lista da conversa.
#[tauri::command(async)]
pub fn start_background_task(
    app: AppHandle,
    tasks: State<'_, BackgroundTasks>,
    conversation_id: String,
    prompt: String,
    cwd: String,
    permission: Permission,
) -> Result<BackgroundTask, String> {
    let prompt = prompt.trim().to_string();
    if prompt.is_empty() {
        return Err("a tarefa em segundo plano não pode ficar vazia".into());
    }
    // Valida antes de reservar: um pedido inválido não deixa vaga ocupada.
    let request = claude::background_request(prompt.clone(), PathBuf::from(&cwd), permission, None);
    request.validate()?;
    let id = new_task_id();
    tasks
        .0
        .lock()
        .expect("lock das tarefas em segundo plano")
        .reserve(&id, &prompt, &conversation_id)?;

    let mut session = match Session::start_with_args(&request, claude::background_args(&request)) {
        Ok(session) => session,
        Err(error) => {
            let mut board = tasks.0.lock().expect("lock das tarefas em segundo plano");
            board.finish(&id, false, error.clone());
            return Err(error);
        }
    };
    let task = {
        let mut board = tasks.0.lock().expect("lock das tarefas em segundo plano");
        board.attach(&id, session.cancel_handle());
        board
            .list()
            .into_iter()
            .find(|task| task.id == id)
            .ok_or("a tarefa saiu do registro antes de começar")?
    };

    // O processo é independente do turno: a conversa segue livre enquanto ele roda.
    std::thread::spawn(move || {
        let mut output = String::new();
        let mut ok = true;
        session.pump(ProviderKind::Claude, |event| match event {
            ProviderEvent::TextDelta { text } => output.push_str(&text),
            ProviderEvent::Error { message } => {
                ok = false;
                if !output.is_empty() {
                    output.push('\n');
                }
                output.push_str(&message);
            }
            ProviderEvent::Done { ok: done } => ok &= done,
            _ => {}
        });
        let _ = session.finish();
        let state = app.state::<BackgroundTasks>();
        let finished = state
            .0
            .lock()
            .expect("lock das tarefas em segundo plano")
            .finish(&id, ok, output);
        if let Some(task) = finished {
            let _ = app.emit(TASK_EVENT, task);
        }
    });

    Ok(task)
}

/// Para uma tarefa em andamento e devolve o estado novo dela.
#[tauri::command(async)]
pub fn stop_background_task(tasks: State<'_, BackgroundTasks>, id: String) -> Result<BackgroundTask, String> {
    tasks.0.lock().expect("lock das tarefas em segundo plano").stop(&id)
}

/// Tarefas desta sessão do app, na ordem em que foram criadas.
#[tauri::command(async)]
pub fn list_background_tasks(tasks: State<'_, BackgroundTasks>, conversation_id: String) -> Vec<BackgroundTask> {
    tasks
        .0
        .lock()
        .expect("lock das tarefas em segundo plano")
        .of_conversation(&conversation_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Acima do limite, o pedido é recusado com uma mensagem que diz o que fazer.
    #[test]
    fn recusa_tarefas_acima_do_limite_com_mensagem_clara() {
        let mut board = Board::default();
        for index in 1..=MAX_BACKGROUND_TASKS {
            board
                .reserve(&format!("t{index}"), "tarefa", "c1")
                .expect("dentro do limite deve ser aceito");
        }

        let error = board.reserve("t4", "outra tarefa", "c1").expect_err("acima do limite deve ser recusado");

        assert!(error.contains(&MAX_BACKGROUND_TASKS.to_string()), "mensagem: {error}");
        assert!(error.to_lowercase().contains("pare"), "mensagem: {error}");
        assert_eq!(board.list().len(), MAX_BACKGROUND_TASKS);
    }

    /// Processo de teste que fica rodando até ser parado (ping de 60 s).
    #[cfg(windows)]
    fn processo_longo() -> Session {
        Session::spawn(
            crate::providers::ProviderKind::Claude,
            "",
            "C:\\Windows\\System32\\cmd.exe",
            vec!["/C".into(), "ping".into(), "-n".into(), "60".into(), "127.0.0.1".into()],
            None,
            &[],
        )
        .expect("cmd.exe deve existir")
    }

    /// Parar uma tarefa ligada ao processo mata o processo e muda o status para parada.
    #[test]
    #[cfg(windows)]
    fn parar_mata_o_processo_e_muda_o_status_para_parada() {
        let mut board = Board::default();
        board.reserve("t1", "primeira", "c1").unwrap();
        let mut session = processo_longo();
        board.attach("t1", session.cancel_handle());

        let stopped = board.stop("t1").expect("tarefa ligada deve parar");

        assert_eq!(stopped.status, TaskStatus::Stopped);
        let started = std::time::Instant::now();
        session.finish().expect("processo deve terminar depois de parado");
        assert!(started.elapsed() < std::time::Duration::from_secs(30));
    }

    /// Enquanto o processo ainda não está ligado, parar não pode marcar a tarefa como parada:
    /// o CLI continuaria rodando e gastando tokens. O pedido é recusado com mensagem clara.
    #[test]
    fn parar_antes_de_ligar_o_processo_devolve_erro() {
        let mut board = Board::default();
        board.reserve("t1", "primeira", "c1").unwrap();

        let error = board.stop("t1").expect_err("sem processo ligado não pode parar");

        assert!(error.contains("iniciando"), "mensagem: {error}");
        assert_eq!(board.list()[0].status, TaskStatus::Running);
    }

    /// Parar libera uma vaga para outra tarefa.
    #[test]
    #[cfg(windows)]
    fn parar_libera_uma_vaga() {
        let mut board = Board::default();
        let mut sessions = Vec::new();
        for index in 1..=MAX_BACKGROUND_TASKS {
            let id = format!("t{index}");
            board.reserve(&id, "tarefa", "c1").unwrap();
            let session = processo_longo();
            board.attach(&id, session.cancel_handle());
            sessions.push(session);
        }

        board.stop("t1").expect("tarefa ligada deve parar");
        board.reserve("t4", "outra tarefa", "c1").expect("a vaga liberada deve aceitar outra tarefa");
    }

    /// A lista de uma conversa não mostra tarefas pedidas por outra.
    #[test]
    fn lista_so_as_tarefas_da_conversa() {
        let mut board = Board::default();
        board.reserve("t1", "da primeira", "c1").unwrap();
        board.reserve("t2", "da segunda", "c2").unwrap();

        let ids = |tasks: Vec<BackgroundTask>| tasks.into_iter().map(|task| task.id).collect::<Vec<_>>();

        assert_eq!(ids(board.of_conversation("c1")), ["t1"]);
        assert_eq!(ids(board.of_conversation("c2")), ["t2"]);
        assert!(board.of_conversation("c3").is_empty());
    }

    /// Parar uma tarefa que não existe é erro de leitura clara, não pânico.
    #[test]
    fn parar_tarefa_inexistente_devolve_erro() {
        let mut board = Board::default();

        let error = board.stop("nao-existe").expect_err("id desconhecido deve ser erro");

        assert!(error.contains("nao-existe"), "mensagem: {error}");
    }
}
