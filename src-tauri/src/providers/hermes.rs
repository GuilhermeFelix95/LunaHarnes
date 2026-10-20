//! Hermes (Nous Research). Por enquanto só a conexão da conta: o chat ainda não fala com ele, porque o formato
//! de saída de uma resposta completa não foi medido (ver docs/stack.md, medição do Hermes).

use super::ProviderEvent;

/// Mensagem do chat: o Hermes aparece em Contas para conectar, mas não é motor de conversa ainda.
pub fn parse_line(_line: &str) -> Vec<ProviderEvent> {
    vec![ProviderEvent::Error {
        message: "O Hermes ainda não conversa pelo chat do LunaCode. Conecte a conta em Contas.".into(),
    }]
}

/// Conectado = alguma credencial guardada pelo Hermes. `hermes auth list` lista cada provedor com a contagem,
/// como `nous (1 credentials):`; só conta quando a contagem é maior que zero.
pub fn has_credentials(output: &str) -> bool {
    output.lines().any(|line| {
        line.split_once(" credentials)")
            .and_then(|(before, _)| before.rsplit('(').next())
            .and_then(|count| count.trim().parse::<u32>().ok())
            .is_some_and(|count| count > 0)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_provider_with_a_credential_counts_as_connected() {
        let output = "copilot (1 credentials):\n  #1  gh auth token  api_key\n\nnous (1 credentials):\n  #1  oauth\n";
        assert!(has_credentials(output));
    }

    #[test]
    fn empty_listings_are_not_connected() {
        assert!(!has_credentials(""));
        assert!(!has_credentials("nous (0 credentials):\nopenai-codex (0 credentials):\n"));
    }

    #[test]
    fn chat_says_it_is_not_a_chat_engine_yet() {
        let events = parse_line("qualquer coisa");
        assert!(matches!(&events[0], ProviderEvent::Error { message } if message.contains("Conecte a conta")));
    }
}
