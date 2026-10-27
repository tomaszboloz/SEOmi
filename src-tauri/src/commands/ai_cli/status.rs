use super::{auth::command_for, run_ai_cli, version::version_check};
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCliStatus {
    pub provider: String,
    pub command: String,
    pub available: bool,
    pub detail: String,
}

pub(super) async fn test_ai_cli_connection(provider: String) -> Result<AiCliStatus, String> {
    connection_status(provider, |provider| {
        run_ai_cli(provider, "Reply with OK only.".into(), None)
    })
    .await
}

async fn connection_status<F, Fut>(provider: String, probe: F) -> Result<AiCliStatus, String>
where
    F: FnOnce(String) -> Fut,
    Fut: std::future::Future<Output = Result<String, String>>,
{
    let command = command_for(&provider)?;
    let (available, detail) = if provider == "gemini" {
        // Gemini has no stable auth-status command. An explicit connection
        // test must prove that a minimal isolated request can complete.
        match probe(provider.clone()).await {
            Ok(_) => (true, "Authenticated local CLI request completed.".into()),
            Err(error) => (false, error),
        }
    } else {
        version_check(&provider, command).await
    };
    Ok(AiCliStatus {
        provider,
        command: command.into(),
        available,
        detail,
    })
}

#[cfg(test)]
mod tests {
    use super::connection_status;

    #[tokio::test]
    async fn gemini_is_available_only_when_the_isolated_probe_completes() {
        let ok = connection_status("gemini".into(), |_| async { Ok("OK".into()) })
            .await
            .unwrap();
        assert!(ok.available);
        assert_eq!(ok.detail, "Authenticated local CLI request completed.");
        let failed = connection_status("gemini".into(), |_| async { Err("not signed in".into()) })
            .await
            .unwrap();
        assert!(!failed.available);
        assert_eq!(failed.detail, "not signed in");
    }
}
