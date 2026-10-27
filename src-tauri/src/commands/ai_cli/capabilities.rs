use super::{
    auth::required_capabilities, diagnostics::output_text_full, execution::process_for,
    paths::augmented_path, resolution::ResolvedCommand, streams::bounded_process_output,
};
use tokio::time::{timeout, Duration};

fn apply_path(process: &mut tokio::process::Command, path: Option<std::ffi::OsString>) {
    if let Some(path) = path {
        process.env("PATH", path);
    }
}

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
    apply_path(&mut process, augmented_path());
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

#[cfg(test)]
mod tests {
    use super::apply_path;
    use std::ffi::OsStr;

    #[test]
    fn apply_path_sets_the_path_only_when_one_is_available() {
        let mut process = tokio::process::Command::new("program");
        apply_path(&mut process, None);
        assert!(process.as_std().get_envs().next().is_none());
        apply_path(&mut process, Some("/custom/bin".into()));
        let envs: Vec<_> = process.as_std().get_envs().collect();
        assert_eq!(
            envs,
            vec![(OsStr::new("PATH"), Some(OsStr::new("/custom/bin")))]
        );
    }
}
