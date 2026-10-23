//! Clonador de sites: lê a página e resume o que seria copiado (título, cores, animações e componentes).
//! Nesta etapa só o HTML da página e o CSS embutido são lidos; folhas de estilo externas são só contadas.

use std::time::Duration;

use serde::Serialize;
use tauri::Url;

const FETCH_TIMEOUT: Duration = Duration::from_secs(20);
const MAX_PAGE_BYTES: usize = 3 * 1024 * 1024;
const MAX_COLORS: usize = 24;
const MAX_VARIABLES: usize = 24;
const MAX_EMBEDDED_CSS: usize = 4000;
const COMPONENT_TAGS: [&str; 8] = ["header", "nav", "main", "section", "article", "form", "footer", "button"];

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SiteCapture {
    pub url: String,
    pub title: String,
    pub colors: Vec<String>,
    pub keyframes: usize,
    pub components: Vec<String>,
    pub stylesheets: usize,
    /// Variáveis CSS com cor (`--cor-primaria: #1a73e8`), para o agente usar a paleta do site.
    pub css_variables: Vec<String>,
    /// CSS embutido na página, com espaços juntos e corte no tamanho máximo.
    pub embedded_css: String,
}

/// Aceita só http e https: o clonador não lê arquivos locais.
pub fn parse_site_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw.trim()).map_err(|_| "endereço inválido".to_string())?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        _ => Err("use um endereço http ou https".into()),
    }
}

/// O aviso de direitos autorais é obrigatório: sem a confirmação, nada é lido.
pub fn check_rights(confirmed: bool) -> Result<(), String> {
    if confirmed {
        Ok(())
    } else {
        Err("confirme que você tem direitos sobre este conteúdo antes de copiar".into())
    }
}

/// Resume a página. Só lê texto: cores são códigos hexadecimais, animações são `@keyframes`.
pub fn capture_html(url: &Url, html: &str) -> SiteCapture {
    // Minúsculas em ASCII mantêm os mesmos índices do original, então dá para buscar nos dois.
    let lower = html.to_ascii_lowercase();
    let styles = style_text(html, &lower);
    SiteCapture {
        url: url.to_string(),
        title: title_of(html, &lower),
        colors: colors_of(&lower),
        keyframes: lower.matches("@keyframes").count(),
        components: COMPONENT_TAGS
            .iter()
            .filter(|tag| has_tag(&lower, tag))
            .map(|tag| tag.to_string())
            .collect(),
        stylesheets: stylesheet_links(&lower),
        css_variables: css_color_variables(&styles),
        embedded_css: summarize_css(&styles),
    }
}

/// Texto de todos os blocos `<style>` da página, na ordem em que aparecem.
fn style_text(html: &str, lower: &str) -> String {
    let mut out = String::new();
    let mut from = 0;
    while let Some(start) = lower[from..].find("<style") {
        let open = from + start;
        let Some(gt) = lower[open..].find('>') else { break };
        let body = open + gt + 1;
        let Some(close) = lower[body..].find("</style>") else { break };
        out.push_str(&html[body..body + close]);
        out.push('\n');
        from = body + close + "</style>".len();
    }
    out
}

/// Declarações `--nome: valor` cujo valor tem cor (hex, rgb ou hsl). Nomes e valores vêm do CSS original.
fn css_color_variables(css: &str) -> Vec<String> {
    let lower = css.to_ascii_lowercase();
    let mut found: Vec<String> = Vec::new();
    for (i, _) in lower.match_indices("--") {
        let name: String = css[i + 2..].chars().take_while(|c| c.is_ascii_alphanumeric() || *c == '-').collect();
        if name.is_empty() {
            continue;
        }
        let after = css[i + 2 + name.len()..].trim_start();
        let Some(rest) = after.strip_prefix(':') else { continue };
        let value: &str = rest.split([';', '}', '\n']).next().unwrap_or("").trim();
        let value_lower = value.to_ascii_lowercase();
        if !(value.contains('#') || value_lower.contains("rgb(") || value_lower.contains("hsl(")) {
            continue;
        }
        let declaration = format!("--{name}: {value}");
        if !found.contains(&declaration) {
            found.push(declaration);
        }
        if found.len() == MAX_VARIABLES {
            break;
        }
    }
    found
}

/// CSS embutido em uma linha, cortado em `MAX_EMBEDDED_CSS` caracteres (com a marca de corte).
fn summarize_css(css: &str) -> String {
    let joined = css.split_whitespace().collect::<Vec<_>>().join(" ");
    if joined.chars().count() <= MAX_EMBEDDED_CSS {
        return joined;
    }
    let cut: String = joined.chars().take(MAX_EMBEDDED_CSS).collect();
    format!("{cut} …")
}

fn title_of(html: &str, lower: &str) -> String {
    let Some(start) = lower.find("<title") else { return String::new() };
    let Some(open_end) = lower[start..].find('>').map(|i| start + i + 1) else { return String::new() };
    let Some(close) = lower[open_end..].find("</title>").map(|i| open_end + i) else { return String::new() };
    html[open_end..close].trim().to_string()
}

/// Cores hexadecimais (#rgb, #rgba, #rrggbb, #rrggbbaa) sem repetição, na ordem em que aparecem.
fn colors_of(lower: &str) -> Vec<String> {
    let bytes = lower.as_bytes();
    let mut colors: Vec<String> = Vec::new();
    for (i, byte) in bytes.iter().enumerate() {
        if *byte != b'#' {
            continue;
        }
        let digits = bytes[i + 1..].iter().take_while(|b| b.is_ascii_hexdigit()).count();
        let boundary_ok = bytes.get(i + 1 + digits).is_none_or(|b| !b.is_ascii_alphanumeric());
        if matches!(digits, 3 | 4 | 6 | 8) && boundary_ok {
            let color = lower[i..i + 1 + digits].to_string();
            if !colors.contains(&color) {
                colors.push(color);
            }
        }
    }
    colors.truncate(MAX_COLORS);
    colors
}

/// Diz se a página abre a tag, como `<nav ` ou `<nav>`; `<navbar` não conta.
fn has_tag(lower: &str, tag: &str) -> bool {
    let open = format!("<{tag}");
    lower.match_indices(&open).any(|(i, _)| {
        lower[i + open.len()..].chars().next().is_none_or(|c| c == '>' || c.is_whitespace() || c == '/')
    })
}

/// Conta as tags `<link>` que apontam para folhas de estilo.
fn stylesheet_links(lower: &str) -> usize {
    lower
        .match_indices("<link")
        .filter(|(i, _)| lower[*i..].split('>').next().is_some_and(|tag| tag.contains("stylesheet")))
        .count()
}

/// Lê a página e devolve o resumo. Recusa sem a confirmação de direitos.
#[tauri::command]
pub async fn site_clone_capture(url: String, rights_confirmed: bool) -> Result<SiteCapture, String> {
    check_rights(rights_confirmed)?;
    let target = parse_site_url(&url)?;
    let client = reqwest::Client::builder()
        .timeout(FETCH_TIMEOUT)
        .build()
        .map_err(|e| format!("não foi possível preparar a conexão: {e}"))?;
    let response = client
        .get(target.clone())
        .send()
        .await
        .map_err(|e| format!("não foi possível abrir {}: {e}", target.host_str().unwrap_or("o site")))?;
    if !response.status().is_success() {
        return Err(format!("o site respondeu com status {}", response.status().as_u16()));
    }
    let body = response.bytes().await.map_err(|e| format!("falha ao ler a página: {e}"))?;
    if body.len() > MAX_PAGE_BYTES {
        return Err("página grande demais para capturar".into());
    }
    Ok(capture_html(&target, &String::from_utf8_lossy(&body)))
}

#[cfg(test)]
mod tests {
    use super::*;

    const PAGE: &str = r#"<html><head><title> Loja Exemplo </title>
        <link rel="stylesheet" href="/app.css"><link rel="icon" href="/x.png">
        <style>@keyframes girar { to { transform: rotate(360deg); } } h1 { color: #FF0000; }</style>
        </head><body><header style="background:#fff"><nav class="menu"></nav></header>
        <main><section><button>Comprar</button></section></main><navbar></navbar>
        <p style="color:#abc">Oi #ff0000 #12345 #zz1</p></body></html>"#;

    fn sample() -> SiteCapture {
        capture_html(&Url::parse("https://exemplo.com/").unwrap(), PAGE)
    }

    #[test]
    fn reads_the_title_without_surrounding_spaces() {
        assert_eq!(sample().title, "Loja Exemplo");
    }

    #[test]
    fn collects_each_hex_color_once_in_lowercase() {
        assert_eq!(sample().colors, vec!["#ff0000", "#fff", "#abc"]);
    }

    #[test]
    fn counts_keyframes_and_stylesheet_links() {
        let capture = sample();
        assert_eq!(capture.keyframes, 1);
        assert_eq!(capture.stylesheets, 1, "o link de ícone não é folha de estilo");
    }

    #[test]
    fn lists_only_the_components_the_page_opens() {
        // <navbar> não é <nav>, e <footer> não aparece na página.
        assert_eq!(sample().components, vec!["header", "nav", "main", "section", "button"]);
    }

    #[test]
    fn reads_colour_variables_from_the_page_styles() {
        let html = r#"<style>:root { --cor-primaria: #1A73E8; --espaco: 8px; --fundo: rgb(255, 255, 255); }
            .x { --tamanho: 12px }</style>"#;
        let capture = capture_html(&Url::parse("https://exemplo.com/").unwrap(), html);

        assert_eq!(capture.css_variables, vec!["--cor-primaria: #1A73E8", "--fundo: rgb(255, 255, 255)"]);
    }

    #[test]
    fn summarizes_the_embedded_css_on_one_line_and_cuts_it() {
        let html = format!("<style>\n  .a {{ color: red; }}\n\n  .b {{ {} }}\n</style>", "x".repeat(5000));
        let capture = capture_html(&Url::parse("https://exemplo.com/").unwrap(), &html);

        assert!(capture.embedded_css.starts_with(".a { color: red; } .b {"));
        assert!(!capture.embedded_css.contains('\n'));
        assert!(capture.embedded_css.ends_with(" …"));
        assert!(capture.embedded_css.chars().count() <= MAX_EMBEDDED_CSS + 2);
    }

    #[test]
    fn accepts_only_http_and_https_addresses() {
        assert!(parse_site_url("https://exemplo.com").is_ok());
        assert!(parse_site_url("http://exemplo.com").is_ok());
        assert!(parse_site_url("file:///C:/segredo.txt").is_err());
        assert!(parse_site_url("não é url").is_err());
    }

    #[test]
    fn refuses_to_capture_without_the_rights_notice() {
        assert!(check_rights(false).is_err());
        assert!(check_rights(true).is_ok());
    }
}
