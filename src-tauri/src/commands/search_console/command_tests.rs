use super::*;

#[tokio::test]
async fn public_commands_reject_invalid_clients_before_external_effects() {
    let project = "fixture-project".to_string();
    let invalid = "invalid-client".to_string();
    let expected = "Enter a valid Desktop app OAuth Client ID from Google Cloud Console.";
    assert_eq!(
        connect_search_console(project.clone(), invalid.clone(), None)
            .await
            .err()
            .unwrap(),
        expected
    );
    assert_eq!(
        list_search_console_properties(project.clone(), invalid.clone())
            .await
            .err()
            .unwrap(),
        expected
    );
    assert_eq!(
        search_console_performance(
            project.clone(),
            invalid.clone(),
            "https://fixture.test".into(),
            None,
            None,
            None
        )
        .await
        .err()
        .unwrap(),
        expected
    );
    assert_eq!(
        inspect_search_console_url(
            project,
            invalid,
            "https://fixture.test".into(),
            "https://fixture.test/page".into()
        )
        .await
        .err()
        .unwrap(),
        expected
    );
}

#[tokio::test]
async fn connect_and_disconnect_reject_invalid_projects_before_credential_access() {
    let client = "fixture.apps.googleusercontent.com".to_string();
    for project in ["", "../other", "bad project"] {
        assert_eq!(
            connect_search_console(project.into(), client.clone(), None)
                .await
                .err()
                .unwrap(),
            "Invalid Google Search Console project identifier."
        );
        assert_eq!(
            disconnect_search_console(project.into())
                .await
                .err()
                .unwrap(),
            "Invalid Google Search Console project identifier."
        );
    }
}

#[test]
fn both_credential_names_are_validated_at_boundaries_and_isolated() {
    use super::credentials::{client_secret_key, refresh_token_key};
    for length in [1, 80] {
        let id = "a".repeat(length);
        assert_eq!(
            refresh_token_key(&id).unwrap(),
            format!("gsc_refresh_token_{id}")
        );
        assert_eq!(
            client_secret_key(&id).unwrap(),
            format!("gsc_client_secret_{id}")
        );
    }
    for id in ["".to_string(), "a".repeat(81), "../x".into(), "żółć".into()] {
        assert!(refresh_token_key(&id).is_err());
        assert!(client_secret_key(&id).is_err());
    }
    assert_ne!(
        client_secret_key("p1").unwrap(),
        client_secret_key("p2").unwrap()
    );
}
