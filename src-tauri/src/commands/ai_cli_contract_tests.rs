use super::detect_ai_clis_with;

#[tokio::test]
async fn detection_maps_each_provider_and_preserves_checker_results() {
    let mut calls = Vec::new();
    let results = detect_ai_clis_with(|provider, command| {
        calls.push((provider.to_string(), command.to_string()));
        async move {
            tokio::task::yield_now().await;
            (provider != "claude", format!("{provider}:{command}"))
        }
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
    assert_eq!(
        serde_json::to_value(results).unwrap(),
        serde_json::json!([
            {
                "provider": "openai", "command": "codex",
                "available": true, "detail": "openai:codex"
            },
            {
                "provider": "claude", "command": "claude",
                "available": false, "detail": "claude:claude"
            },
            {
                "provider": "gemini", "command": "gemini",
                "available": true, "detail": "gemini:gemini"
            },
        ])
    );
}

#[tokio::test]
async fn detection_reports_all_failures_without_rewriting_diagnostics() {
    let diagnostics = [
        "",
        "Not logged in.\nSign in first.",
        "Błąd CLI: brak dostępu",
    ];
    let mut diagnostics_iter = diagnostics.into_iter();
    let results = detect_ai_clis_with(|_, _| {
        let detail = diagnostics_iter.next().unwrap().to_string();
        std::future::ready((false, detail))
    })
    .await;

    assert_eq!(results.len(), diagnostics.len());
    for (status, expected_detail) in results.iter().zip(diagnostics) {
        assert!(!status.available);
        assert_eq!(status.detail, expected_detail);
    }
    assert_eq!(diagnostics_iter.next(), None);
}

#[tokio::test]
async fn public_detection_wrapper_returns_the_supported_provider_contract() {
    let results = super::detect_ai_clis().await;

    assert_eq!(results.len(), 3);
    assert_eq!(
        results
            .iter()
            .map(|status| (status.provider.as_str(), status.command.as_str()))
            .collect::<Vec<_>>(),
        vec![
            ("openai", "codex"),
            ("claude", "claude"),
            ("gemini", "gemini")
        ]
    );
    assert!(results.iter().all(|status| !status.detail.is_empty()));
}
