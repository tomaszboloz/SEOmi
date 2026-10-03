use super::{
    auth::{auth_check_args, authenticated_output},
    diagnostics::{display_output, output_text},
    execution::process_for,
    paths::augmented_path,
    resolution::{resolve_command, ResolvedCommand},
    streams::bounded_process_output,
};
use tokio::time::{timeout, Duration};

pub(super) async fn version_check(provider: &str, command: &str) -> (bool, String) {
    let Some(resolved) = resolve_command(command) else {
        return (
            false,
            "Not found on PATH or known user install locations.".to_string(),
        );
    };
    version_check_resolved(provider, &resolved).await
}

pub(super) async fn version_check_resolved(
    provider: &str,
    resolved: &ResolvedCommand,
) -> (bool, String) {
    let result = timeout(Duration::from_secs(5), {
        let mut process = process_for(resolved, &["--version".to_string()]);
        process.kill_on_drop(true);
        if let Some(path) = augmented_path() {
            process.env("PATH", path);
        }
        bounded_process_output(process, "")
    })
    .await;
    match result {
        Ok(Ok(output)) if output.status.success() => {
            let detail = display_output(&output);
            let mut available = true;
            let mut auth_detail = String::new();
            if let Some(arguments) = auth_check_args(provider) {
                let auth_arguments = arguments
                    .iter()
                    .map(|argument| (*argument).to_string())
                    .collect::<Vec<_>>();
                let mut auth_process = process_for(resolved, &auth_arguments);
                auth_process.kill_on_drop(true);
                if let Some(path) = augmented_path() {
                    auth_process.env("PATH", path);
                }
                let auth_result = timeout(
                    Duration::from_secs(5),
                    bounded_process_output(auth_process, ""),
                )
                .await;
                if let Ok(Ok(auth_output)) = auth_result {
                    available = auth_output.status.success()
                        && authenticated_output(provider, &output_text(&auth_output));
                    if !available {
                        auth_detail = "Local CLI is not authenticated. Sign in with the provider CLI and test again.".to_string();
                    }
                } else {
                    available = false;
                    auth_detail =
                        "Unable to verify CLI authentication (timeout or process failure)."
                            .to_string();
                }
            }

            (
                available,
                if !auth_detail.is_empty() {
                    auth_detail
                } else if detail.is_empty() {
                    "Available on PATH.".to_string()
                } else {
                    detail
                },
            )
        }
        Ok(Ok(output)) => {
            let detail = display_output(&output);
            (
                false,
                if detail.is_empty() {
                    "Command is installed but its version check failed.".to_string()
                } else {
                    detail
                },
            )
        }
        Ok(Err(error)) => (false, format!("Unable to start local CLI: {error}")),
        Err(_) => (false, "Version check timed out.".to_string()),
    }
}
