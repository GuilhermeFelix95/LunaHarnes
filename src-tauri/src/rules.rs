//! Regras globais: o texto do CLAUDE.md que o usuário cola em Configurações.
//!
//! O texto fica em `<app_data>/rules.md`. Ao salvar, o mesmo bloco vai para `~/.claude/CLAUDE.md`
//! (Claude Code) e `~/.codex/AGENTS.md` (Codex), entre marcadores. O que o usuário já tinha fora
//! dos marcadores é preservado, e o arquivo anterior vai para um `.bak-<segundos>` antes da troca.
//! Perfis de API não leem o `~/.claude`, então o texto também entra no prompt deles (`with_rules`).

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::AppHandle;

use crate::commands::app_data_dir;

const FILE_NAME: &str = "rules.md";
const START: &str = "<!-- luna:rules:start -->";
const END: &str = "<!-- luna:rules:end -->";
pub const MAX_BYTES: usize = 64 * 1024;

/// Texto salvo nas regras, ou vazio quando o usuário ainda não colou nada.
pub fn load(dir: &Path) -> Result<String, String> {
    match fs::read_to_string(dir.join(FILE_NAME)) {
        Ok(text) => Ok(text),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(format!("não foi possível ler {FILE_NAME}: {e}")),
    }
}

/// Grava as regras trocando o arquivo por inteiro: primeiro um temporário, depois o nome final.
pub fn save(dir: &Path, text: &str) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("não foi possível criar a pasta de dados: {e}"))?;
    let tmp = dir.join(format!("{FILE_NAME}.tmp"));
    fs::write(&tmp, text).map_err(|e| format!("não foi possível gravar {FILE_NAME}: {e}"))?;
    fs::rename(&tmp, dir.join(FILE_NAME)).map_err(|e| format!("não foi possível salvar {FILE_NAME}: {e}"))
}

/// Coloca o bloco da Luna no texto existente. Com marcadores, troca só o bloco; sem eles, acrescenta no fim.
/// Regras vazias tiram o bloco.
pub fn merge_block(existing: &str, rules: &str) -> String {
    let block = if rules.trim().is_empty() {
        String::new()
    } else {
        format!("{START}\n{}\n{END}", rules.trim())
    };
    match (existing.find(START), existing.find(END)) {
        (Some(start), Some(end)) if start < end => {
            let after = end + END.len();
            format!("{}{block}{}", &existing[..start], &existing[after..])
        }
        _ if block.is_empty() => existing.to_string(),
        _ if existing.trim().is_empty() => format!("{block}\n"),
        _ => format!("{}\n\n{block}\n", existing.trim_end()),
    }
}

/// Texto do bloco da Luna dentro de um CLAUDE.md. Sem marcadores, o arquivo inteiro (para importar a primeira vez).
pub fn extract_block(existing: &str) -> String {
    match (existing.find(START), existing.find(END)) {
        (Some(start), Some(end)) if start < end => existing[start + START.len()..end].trim().to_string(),
        _ => existing.trim().to_string(),
    }
}

/// Acrescenta as regras antes do pedido, para perfis de API (o CLI deles não lê o arquivo global).
pub fn with_rules(rules: &str, prompt: &str) -> String {
    if rules.trim().is_empty() {
        return prompt.to_string();
    }
    format!("Regras globais do usuário (siga-as em toda resposta):\n{}\n\n{prompt}", rules.trim())
}

/// Escreve o bloco num arquivo de configuração de CLI. Faz backup do conteúdo anterior quando muda.
fn write_cli_file(path: &Path, rules: &str) -> Result<(), String> {
    let existing = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(e) => return Err(format!("não foi possível ler {}: {e}", path.display())),
    };
    let merged = merge_block(&existing, rules);
    if merged == existing {
        return Ok(());
    }
    let parent = path.parent().ok_or_else(|| format!("caminho sem pasta: {}", path.display()))?;
    fs::create_dir_all(parent).map_err(|e| format!("não foi possível criar {}: {e}", parent.display()))?;
    if !existing.is_empty() {
        let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        let name = format!("{}.bak-{secs}", path.file_name().and_then(|n| n.to_str()).unwrap_or("arquivo"));
        fs::write(path.with_file_name(name), &existing)
            .map_err(|e| format!("não foi possível fazer backup de {}: {e}", path.display()))?;
    }
    let tmp = path.with_extension("md.tmp");
    fs::write(&tmp, merged).map_err(|e| format!("não foi possível gravar {}: {e}", path.display()))?;
    fs::rename(&tmp, path).map_err(|e| format!("não foi possível salvar {}: {e}", path.display()))
}

/// Arquivos das CLIs que recebem as regras: `~/.claude/CLAUDE.md` e `~/.codex/AGENTS.md`.
fn cli_files(home: &Path) -> [PathBuf; 2] {
    [home.join(".claude").join("CLAUDE.md"), home.join(".codex").join("AGENTS.md")]
}

#[tauri::command(async)]
pub fn get_rules(app: AppHandle) -> Result<String, String> {
    load(&app_data_dir(&app)?)
}

/// Recusa texto grande demais ou com os marcadores do bloco (quebrariam a troca).
fn check(text: &str) -> Result<(), String> {
    if text.len() > MAX_BYTES {
        return Err(format!("as regras passam do limite de {} KB", MAX_BYTES / 1024));
    }
    if text.contains(START) || text.contains(END) {
        return Err("as regras não podem conter os marcadores da Luna".into());
    }
    Ok(())
}

/// Salva as regras no app e nos arquivos das CLIs. Devolve os caminhos gravados.
#[tauri::command]
pub fn save_rules(app: AppHandle, text: String) -> Result<Vec<String>, String> {
    check(&text)?;
    save(&app_data_dir(&app)?, &text)?;
    let home = crate::slash::home_dir().ok_or("não foi possível localizar a pasta do usuário")?;
    let files = cli_files(&home);
    for file in &files {
        write_cli_file(file, &text)?;
    }
    Ok(files.iter().map(|f| f.display().to_string()).collect())
}

/// Lê o bloco atual do `~/.claude/CLAUDE.md` (ou o arquivo inteiro), para colar nas regras.
#[tauri::command(async)]
pub fn import_rules() -> Result<String, String> {
    let home = crate::slash::home_dir().ok_or("não foi possível localizar a pasta do usuário")?;
    let path = &cli_files(&home)[0];
    match fs::read_to_string(path) {
        Ok(text) => Ok(extract_block(&text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(format!("não foi possível ler {}: {e}", path.display())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("lunaharness-rules-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn troca_so_o_bloco_e_preserva_o_que_esta_fora_dos_marcadores() {
        let existing = format!("# Meu CLAUDE\nfora\n{START}\nvelho\n{END}\ndepois\n");
        let merged = merge_block(&existing, "novo");

        assert!(merged.starts_with("# Meu CLAUDE\nfora\n"));
        assert!(merged.contains(&format!("{START}\nnovo\n{END}")));
        assert!(merged.ends_with("\ndepois\n"));
        assert!(!merged.contains("velho"));
    }

    #[test]
    fn sem_marcadores_acrescenta_no_fim_e_regra_vazia_nao_mexe() {
        assert_eq!(merge_block("", "x"), format!("{START}\nx\n{END}\n"));
        assert_eq!(merge_block("uso pessoal", "x"), format!("uso pessoal\n\n{START}\nx\n{END}\n"));
        assert_eq!(merge_block("uso pessoal\n", ""), "uso pessoal\n");
    }

    #[test]
    fn regra_vazia_tira_o_bloco_existente() {
        let existing = format!("antes\n{START}\nx\n{END}\n");
        assert!(!merge_block(&existing, "").contains(START));
    }

    #[test]
    fn importa_o_bloco_ou_o_arquivo_inteiro() {
        assert_eq!(extract_block(&format!("a\n{START}\n  regra  \n{END}\nb")), "regra");
        assert_eq!(extract_block("  arquivo todo  \n"), "arquivo todo");
    }

    #[test]
    fn arquivo_da_cli_ganha_backup_e_mantem_o_conteudo_de_fora() {
        let dir = temp("cli");
        let path = dir.join(".claude").join("CLAUDE.md");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "uso pessoal\n").unwrap();

        write_cli_file(&path, "regra 1").unwrap();

        let text = fs::read_to_string(&path).unwrap();
        assert!(text.starts_with("uso pessoal"));
        assert!(text.contains("regra 1"));
        let backups = fs::read_dir(path.parent().unwrap())
            .unwrap()
            .filter(|e| e.as_ref().unwrap().file_name().to_string_lossy().contains(".bak-"))
            .count();
        assert_eq!(backups, 1);
    }

    #[test]
    fn recusa_texto_acima_do_limite_ou_com_marcadores() {
        assert!(check(&"a".repeat(MAX_BYTES + 1)).is_err());
        assert!(check(&format!("oi {END}")).is_err());
        assert!(check("regra").is_ok());
    }

    #[test]
    fn salva_e_carrega_no_app() {
        let dir = temp("app");
        save(&dir, "regra").unwrap();
        assert_eq!(load(&dir).unwrap(), "regra");
        assert_eq!(load(&temp("vazio")).unwrap(), "");
    }

    #[test]
    fn prompt_de_perfil_recebe_as_regras_antes_do_pedido() {
        assert_eq!(with_rules("", "oi"), "oi");
        assert!(with_rules("sempre em português", "oi").ends_with("\n\noi"));
    }
}
