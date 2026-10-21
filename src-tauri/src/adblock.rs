//! Bloqueador de anúncios do navegador: recusa as requisições para domínios de anúncio e rastreamento.
//! Ligado por padrão; o usuário pode pausar. A flag vale para todas as abas na hora, porque o filtro a consulta
//! a cada requisição.
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::Webview;

/// Domínios de anúncios e rastreadores comuns. Um domínio da lista bloqueia também os subdomínios dele.
const AD_HOSTS: &[&str] = &[
    "doubleclick.net",
    "googlesyndication.com",
    "googleadservices.com",
    "adservice.google.com",
    "pagead2.googlesyndication.com",
    "adnxs.com",
    "criteo.com",
    "taboola.com",
    "outbrain.com",
    "scorecardresearch.com",
    "moatads.com",
    "pubmatic.com",
    "rubiconproject.com",
    "openx.net",
    "amazon-adsystem.com",
    "adsrvr.org",
    "media.net",
    "popads.net",
    "propellerads.com",
    "adform.net",
];

static ENABLED: AtomicBool = AtomicBool::new(true);

/// Liga ou pausa o bloqueador para todas as abas.
pub fn set_enabled(on: bool) {
    ENABLED.store(on, Ordering::SeqCst);
}

pub fn is_enabled() -> bool {
    ENABLED.load(Ordering::SeqCst)
}

/// Verdadeiro se o host é um domínio da lista ou um subdomínio dele.
pub fn is_ad_host(host: &str) -> bool {
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    AD_HOSTS.iter().any(|ad| host == *ad || host.ends_with(&format!(".{ad}")))
}

/// Liga o filtro de requisições de uma aba. Falha só vai para o log: a aba segue sem bloqueio.
#[cfg(windows)]
pub fn install(view: &Webview) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{ICoreWebView2_2, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL};
    use webview2_com::{take_pwstr, WebResourceRequestedEventHandler};
    use windows_core::{w, Interface, PWSTR};

    let result = view.with_webview(|platform| {
        let controller = platform.controller();
        let outcome = unsafe {
            controller.CoreWebView2().and_then(|core| {
                let env = core.cast::<ICoreWebView2_2>()?.Environment()?;
                core.AddWebResourceRequestedFilter(w!("*"), COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL)?;
                let mut token = 0i64;
                let handler = WebResourceRequestedEventHandler::create(Box::new(move |_, args| {
                    let Some(args) = args else { return Ok(()) };
                    if !is_enabled() {
                        return Ok(());
                    }
                    let request = args.Request()?;
                    let mut uri = PWSTR::null();
                    request.Uri(&mut uri)?;
                    let uri = take_pwstr(uri);
                    let blocked = tauri::Url::parse(&uri).ok().and_then(|u| u.host_str().map(is_ad_host)).unwrap_or(false);
                    if blocked {
                        let response = env.CreateWebResourceResponse(None, 403, w!("Blocked"), w!(""))?;
                        args.SetResponse(&response)?;
                    }
                    Ok(())
                }));
                core.add_WebResourceRequested(&handler, &mut token)
            })
        };
        if let Err(e) = outcome {
            crate::logfile::error(&format!("o WebView2 recusou o bloqueador de anúncios: {e}"));
        }
    });
    if let Err(e) = result {
        crate::logfile::error(&format!("não foi possível ligar o bloqueador de anúncios da aba: {e}"));
    }
}

#[cfg(not(windows))]
pub fn install(_view: &Webview) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_listed_domains_and_their_subdomains() {
        assert!(is_ad_host("doubleclick.net"));
        assert!(is_ad_host("ad.doubleclick.net"));
        assert!(is_ad_host("Pagead2.GoogleSyndication.com"));
    }

    #[test]
    fn leaves_other_hosts_alone_even_when_the_name_ends_the_same_way() {
        assert!(!is_ad_host("notdoubleclick.net"));
        assert!(!is_ad_host("example.com"));
        assert!(!is_ad_host("translate.google.com"));
    }

    #[test]
    fn pausing_turns_the_filter_off_for_every_tab() {
        set_enabled(false);
        assert!(!is_enabled());
        set_enabled(true);
        assert!(is_enabled());
    }
}
