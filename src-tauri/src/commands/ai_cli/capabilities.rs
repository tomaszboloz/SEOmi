use super::{
    auth::required_capabilities, diagnostics::output_text_full, execution::process_for,
    paths::augmented_path, resolution::ResolvedCommand, streams::bounded_process_output,
};
use tokio::time::{timeout, Duration};

pub(super) async fn check_capabilities(
    provider: &str,
    resolved: &ResolvedCommand,
) -> Result<(), String> {
    let args = if provider == "openai" {
        vec!["exec".into(), "--help".into()]
    } else {
        vec!["--help".into()]
    };
    let mut process = process_for(resolved, &args);
    process.kill_on_drop(true);
    if let Some(path) = augmented_path() {
        process.env("PATH", path);
    }
    let output = timeout(Duration::from_secs(10), bounded_process_output(process, ""))
        .await
        .map_err(|_| "CLI capability check timed out.".to_string())?
        .map_err(|_| "Unable to check local CLI capabilities.".to_string())?;
    let help = output_text_full(&output);
    if !output.status.success()
        || required_capabilities(provider)
            .iter()
            .any(|flag| !help.contains(flag))
    {
        return Err(format!("Update {provider} CLI: this version does not support the isolation flags required for neutral research."));
    }
    Ok(())
}
