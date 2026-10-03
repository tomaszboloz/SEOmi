use super::{
    arguments::build_ai_cli_arguments,
    auth::{auth_check_args, authenticated_output, command_for, required_capabilities},
    run_ai_cli, test_ai_cli_connection,
};

#[test]
fn provider_commands_and_auth_modes_are_explicit_and_unknowns_are_rejected() {
    assert_eq!(command_for("openai").unwrap(), "codex");
    assert_eq!(command_for("claude").unwrap(), "claude");
    assert_eq!(command_for("gemini").unwrap(), "gemini");
    assert!(command_for("other").is_err());
    assert_eq!(
        auth_check_args("openai"),
        Some(["login", "status"].as_slice())
    );
    assert_eq!(
        auth_check_args("claude"),
        Some(["auth", "status"].as_slice())
    );
    assert_eq!(auth_check_args("gemini"), None);
    assert_eq!(auth_check_args("other"), None);
    assert!(required_capabilities("other").is_empty());
    assert!(build_ai_cli_arguments("other", "prompt".into(), None).is_err());
}

#[test]
fn authentication_accepts_only_complete_positive_status_lines_or_claude_boolean() {
    for text in [
        "Logged in",
        "Logged in using ChatGPT",
        "authenticated",
        "Authenticated with API key.",
        "warning\n  Logged in as tester!  ",
    ] {
        assert!(authenticated_output("openai", text), "{text}");
    }
    for text in [
        "authenticated=false",
        "not authenticated",
        "logged out",
        "unauthenticated",
        "Previously logged in",
        "logged in: false",
        "See docs: authenticated",
        "Authenticated: false",
        "not logged in\nauthenticated",
    ] {
        assert!(!authenticated_output("openai", text), "{text}");
    }
    for text in [
        r#"{"loggedIn":"true"}"#,
        r#"{"other":true}"#,
        "{}",
        r#"{"loggedIn":null}"#,
    ] {
        assert!(!authenticated_output("claude", text), "{text}");
    }
    assert!(authenticated_output("claude", r#"{"loggedIn":true}"#));
}

#[test]
fn omitted_empty_and_whitespace_model_names_do_not_add_an_option() {
    for provider in ["openai", "claude", "gemini"] {
        let base = build_ai_cli_arguments(provider, "-".into(), None).unwrap();
        for model in ["", "  "] {
            assert_eq!(
                build_ai_cli_arguments(provider, "-".into(), Some(model.into())).unwrap(),
                base
            );
        }
        let selected =
            build_ai_cli_arguments(provider, "-".into(), Some("vendor/model:1.0".into())).unwrap();
        assert_eq!(
            selected.iter().filter(|value| *value == "--model").count(),
            1
        );
        assert!(selected.contains(&"vendor/model:1.0".into()));
    }
}

#[tokio::test]
async fn public_entrypoints_reject_invalid_input_before_calling_a_provider() {
    for (prompt, expected) in [
        ("".into(), "empty"),
        ("  ".into(), "empty"),
        ("x".repeat(32001), "32 KB"),
        ("x\0y".into(), "null"),
    ] {
        assert!(run_ai_cli("unknown".into(), prompt, None)
            .await
            .unwrap_err()
            .contains(expected));
    }
    assert!(run_ai_cli("unknown".into(), "valid".into(), None)
        .await
        .unwrap_err()
        .contains("Unsupported"));
    assert!(test_ai_cli_connection("unknown".into())
        .await
        .unwrap_err()
        .contains("Unsupported"));
}
