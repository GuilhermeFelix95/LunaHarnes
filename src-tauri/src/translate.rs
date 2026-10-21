//! Tradução da página do navegador: a aba vai para a tradução automática do Google e volta ao original quando pausada.
//! A página traduzida é o próprio endereço do Google (`/translate?u=...`), então não há script nem cópia do conteúdo.
use tauri::Url;

/// Idioma de destino: o app é em português do Brasil.
const TARGET_LANGUAGE: &str = "pt";
const TRANSLATOR: &str = "https://translate.google.com/translate";

/// Verdadeiro se o endereço é a página de tradução do Google.
fn is_translator(url: &Url) -> bool {
    url.host_str() == Some("translate.google.com") && url.path() == "/translate"
}

/// Endereço da tradução de `original`. Se já é uma tradução, devolve o mesmo endereço.
pub fn translate_url(original: &Url) -> Result<Url, String> {
    if is_translator(original) {
        return Ok(original.clone());
    }
    if !matches!(original.scheme(), "http" | "https") {
        return Err("só páginas http e https podem ser traduzidas".into());
    }
    let mut url = Url::parse(TRANSLATOR).map_err(|e| e.to_string())?;
    url.query_pairs_mut()
        .append_pair("sl", "auto")
        .append_pair("tl", TARGET_LANGUAGE)
        .append_pair("u", original.as_str());
    Ok(url)
}

/// Página original de uma tradução do Google. `None` quando o endereço não é uma tradução.
pub fn original_of(url: &Url) -> Option<Url> {
    if !is_translator(url) {
        return None;
    }
    let (_, original) = url.query_pairs().find(|(key, _)| key == "u")?;
    Url::parse(&original).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(input: &str) -> Url {
        Url::parse(input).unwrap()
    }

    #[test]
    fn translating_wraps_the_page_in_the_google_translator_to_portuguese() {
        let translated = translate_url(&parse("https://example.com/notícia?a=1")).unwrap();

        assert_eq!(translated.host_str(), Some("translate.google.com"));
        let pairs: Vec<(String, String)> = translated.query_pairs().map(|(k, v)| (k.into_owned(), v.into_owned())).collect();
        assert!(pairs.contains(&("sl".into(), "auto".into())));
        assert!(pairs.contains(&("tl".into(), "pt".into())));
        assert!(pairs.contains(&("u".into(), "https://example.com/not%C3%ADcia?a=1".into())));
    }

    #[test]
    fn pausing_gives_back_the_original_page() {
        let original = parse("https://example.com/artigo");
        let translated = translate_url(&original).unwrap();

        assert_eq!(original_of(&translated), Some(original));
    }

    #[test]
    fn a_page_that_is_not_a_translation_has_no_original_to_go_back_to() {
        assert_eq!(original_of(&parse("https://example.com/")), None);
    }

    #[test]
    fn translating_twice_keeps_the_same_translation() {
        let once = translate_url(&parse("https://example.com/")).unwrap();

        assert_eq!(translate_url(&once).unwrap(), once);
    }

    #[test]
    fn only_web_pages_are_translated() {
        assert!(translate_url(&parse("file:///C:/segredo.txt")).is_err());
    }
}
