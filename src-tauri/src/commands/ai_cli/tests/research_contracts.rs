use super::research_fixture::research_fixture;
use crate::commands::ai_cli::research::run_ai_cli_resolved;
use std::{fs, path::PathBuf};

#[tokio::test]
async fn resolved_research_uses_stdin_and_removes_its_isolated_directory() {
    #[cfg(windows)]
    let _permit = super::fixtures::FIXTURE_PROCESS_GATE.lock().await;
    #[cfg(windows)]
    let prompt = "Zażółć & | $(whoami) `echo injected`\nsecond line";
    #[cfg(not(windows))]
    let prompt = "Zażółć & | %PATH% $(whoami) `echo injected`\nsecond line";
    for provider in ["openai", "claude", "gemini"] {
        let (_cleanup, resolved, root) = research_fixture(provider, false);
        // `std::env::temp_dir()` can contain a macOS `/var` symlink while the
        // child reports its canonical `/private/var` cwd. Resolve the fixture
        // root before creating the scratch directory so both observations use
        // the same path spelling.
        let expected_root = root.canonicalize().unwrap();
        assert_eq!(
            run_ai_cli_resolved(
                provider.into(),
                prompt.into(),
                Some("vendor/model:1.0".into()),
                "fixture",
                &resolved,
                &expected_root,
            )
            .await
            .unwrap(),
            prompt,
            "{provider}"
        );
        let cwd = PathBuf::from(fs::read_to_string(root.join("cwd.txt")).unwrap());
        assert_eq!(cwd.parent().unwrap().canonicalize().unwrap(), expected_root);
        assert!(cwd
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("seomi-ai-"));
        assert!(!cwd.exists(), "{provider}: scratch directory leaked");
        let arguments = fs::read_to_string(root.join("args.txt")).unwrap();
        let arguments: Vec<_> = arguments.lines().collect();
        assert!(
            arguments.contains(&"-"),
            "{provider}: stdin sentinel missing"
        );
        assert!(!arguments.iter().any(|arg| arg.contains("Zażółć")));
        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["--model", "vendor/model:1.0"]));
        if provider == "gemini" {
            let settings: serde_json::Value =
                serde_json::from_slice(&fs::read(root.join("settings.json")).unwrap()).unwrap();
            assert_eq!(settings["context"]["includeDirectoryTree"], false);
            assert_eq!(
                settings["context"]["loadMemoryFromIncludeDirectories"],
                false
            );
            assert_eq!(
                settings["context"]["memoryBoundaryMarkers"],
                serde_json::json!([])
            );
            let context = settings["context"]["fileName"].as_str().unwrap();
            assert!(context.starts_with("seomi-no-context-"));
            assert!(context.ends_with(".md"));
        }
    }
}

#[tokio::test]
async fn failed_research_preserves_diagnostics_and_cleans_created_settings() {
    #[cfg(windows)]
    let _permit = super::fixtures::FIXTURE_PROCESS_GATE.lock().await;
    let (_cleanup, resolved, root) = research_fixture("gemini", true);
    let expected_root = root.canonicalize().unwrap();
    assert_eq!(
        run_ai_cli_resolved(
            "gemini".into(),
            "".into(),
            None,
            "fixture",
            &resolved,
            &expected_root
        )
        .await
        .unwrap_err(),
        "fixture research failure"
    );
    let cwd = PathBuf::from(fs::read_to_string(root.join("cwd.txt")).unwrap());
    assert!(!cwd.exists());
    assert!(root.join("settings.json").is_file());
}

#[tokio::test]
async fn invalid_model_and_unwritable_scratch_root_never_start_research() {
    #[cfg(windows)]
    let _permit = super::fixtures::FIXTURE_PROCESS_GATE.lock().await;
    let (_cleanup, resolved, root) = research_fixture("claude", false);
    assert_eq!(
        run_ai_cli_resolved(
            "claude".into(),
            "hello".into(),
            Some("bad;model".into()),
            "fixture",
            &resolved,
            &root,
        )
        .await
        .unwrap_err(),
        "Model identifier contains unsupported characters."
    );
    assert!(!root.join("cwd.txt").exists());
    let blocked = root.join("regular-file");
    fs::write(&blocked, "cannot contain directories").unwrap();
    let error = run_ai_cli_resolved(
        "claude".into(),
        "hello".into(),
        None,
        "fixture",
        &resolved,
        &blocked,
    )
    .await
    .unwrap_err();
    assert!(error.starts_with("Unable to prepare an isolated AI working directory:"));
    assert!(!root.join("cwd.txt").exists());
}
