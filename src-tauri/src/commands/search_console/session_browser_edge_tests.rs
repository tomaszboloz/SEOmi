use super::{
    connect::{connect_search_console_with, oauth_request},
    session_edge_fixture::{dependencies, Store},
    session_fixture::{browser_error, callback_error},
};
use std::{collections::BTreeMap, future::Future, pin::Pin};
use tokio::net::TcpListener;

fn unexpected_browser(_: &str) -> Result<(), String> {
    panic!("validation must precede browser launch")
}

fn unexpected_callback(
    _: TcpListener,
    _: &str,
) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + '_>> {
    panic!("browser failure must precede callback processing")
}

#[tokio::test]
async fn invalid_client_and_project_fail_before_credential_reads_and_browser_launch() {
    for (project, client, expected) in [
        (
            "fixture-project",
            "invalid-client",
            "Enter a valid Desktop app OAuth Client ID",
        ),
        (
            "../other",
            "fixture.apps.googleusercontent.com",
            "Invalid Google Search Console project identifier.",
        ),
    ] {
        let store = Store::default();
        let mut deps = dependencies(&store, "invalid-token-url", "invalid-sites-url");
        deps.open_browser = unexpected_browser;
        deps.receive_code = unexpected_callback;
        let error = connect_search_console_with(project.into(), client.into(), None, deps)
            .await
            .err()
            .unwrap();
        assert!(error.starts_with(expected), "{error}");
        assert!(store.reads.lock().unwrap().is_empty());
        assert!(store.writes.lock().unwrap().is_empty());
    }
}

#[tokio::test]
async fn browser_failure_never_starts_callback_or_changes_credentials() {
    let store = Store::with_values(&[("gsc_refresh_token_fixture-project", "old-refresh")]);
    let mut deps = dependencies(&store, "invalid-token-url", "invalid-sites-url");
    deps.open_browser = browser_error;
    deps.receive_code = unexpected_callback;
    let error = connect_search_console_with(
        "fixture-project".into(),
        "fixture.apps.googleusercontent.com".into(),
        Some("secret".into()),
        deps,
    )
    .await
    .err()
    .unwrap();
    assert_eq!(error, "synthetic browser failure");
    assert_eq!(
        *store.reads.lock().unwrap(),
        vec!["gsc_refresh_token_fixture-project"]
    );
    assert!(store.writes.lock().unwrap().is_empty());
}

#[tokio::test]
async fn callback_failure_never_reads_secret_or_changes_credentials() {
    let store = Store::with_values(&[("gsc_refresh_token_fixture-project", "old-refresh")]);
    let mut deps = dependencies(&store, "invalid-token-url", "invalid-sites-url");
    deps.receive_code = callback_error;
    let error = connect_search_console_with(
        "fixture-project".into(),
        "fixture.apps.googleusercontent.com".into(),
        None,
        deps,
    )
    .await
    .err()
    .unwrap();
    assert_eq!(error, "synthetic callback failure");
    assert_eq!(
        *store.reads.lock().unwrap(),
        vec!["gsc_refresh_token_fixture-project"]
    );
    assert!(store.writes.lock().unwrap().is_empty());
}

#[test]
fn each_browser_session_has_independent_state_verifier_and_matching_pkce() {
    let (_, first_state, first_verifier, _) =
        oauth_request("fixture.apps.googleusercontent.com", 43210).unwrap();
    let (redirect, state, verifier, url) =
        oauth_request("fixture.apps.googleusercontent.com", 43211).unwrap();
    assert_ne!(state, first_state);
    assert_ne!(verifier, first_verifier);
    assert!(state.chars().all(|c| c.is_ascii_hexdigit()));
    assert!((43..=128).contains(&verifier.len()));
    let query = url.query_pairs().into_owned().collect::<BTreeMap<_, _>>();
    assert_eq!(url.scheme(), "https");
    assert_eq!(url.host_str(), Some("accounts.google.com"));
    assert_eq!(query["state"], state);
    assert_eq!(
        query["code_challenge"],
        super::pkce::code_challenge(&verifier)
    );
    assert_eq!(query["redirect_uri"], redirect);
    assert!(!query.contains_key("client_secret"));
    assert!(!query.contains_key("code_verifier"));
}
