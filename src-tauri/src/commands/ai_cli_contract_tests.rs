use super::detect_ai_clis_with;
use std::collections::HashMap;

#[tokio::test]
async fn detection_maps_each_provider_and_preserves_checker_results() {
    let mut calls = Vec::new();
    let results = detect_ai_clis_with(|provider, command| {
        calls.push((provider.to_string(), command.to_string()));
        let available = provider != "claude";
        let detail = format!("{provider}:{command}");
        async move { (available, detail) }
    })
    .await;

    assert_eq!(
        calls,
        vec![
            ("openai".into(), "codex".into()),
            ("claude".into(), "claude".into()),
            ("gemini".into(), "gemini".into()),
        ]
    );
    assert_eq!(results.len(), 3);
    let by_provider: HashMap<_, _> = results
        .into_iter()
        .map(|status| (status.provider, status))
        .collect();
    assert_eq!(by_provider["openai"].command, "codex");
    assert!(by_provider["openai"].available);
    assert_eq!(by_provider["openai"].detail, "openai:codex");
    assert_eq!(by_provider["claude"].command, "claude");
    assert!(!by_provider["claude"].available);
    assert_eq!(by_provider["claude"].detail, "claude:claude");
    assert!(by_provider["gemini"].available);
    assert_eq!(by_provider["gemini"].detail, "gemini:gemini");
}
