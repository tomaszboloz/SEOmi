use super::properties::properties_client;

#[test]
fn properties_client_reports_builder_failure_with_stable_message() {
    let builder = reqwest::Client::builder().user_agent("bad\nagent");
    assert_eq!(
        properties_client(builder).unwrap_err(),
        "Unable to initialize the Search Console client."
    );
}

#[test]
fn properties_client_builds_with_default_builder() {
    assert!(properties_client(reqwest::Client::builder()).is_ok());
}

#[test]
fn revocation_and_performance_clients_report_builder_failures() {
    let broken = || reqwest::Client::builder().user_agent("bad\nagent");
    assert!(super::disconnect::revocation_client(broken())
        .unwrap_err()
        .contains("revocation client"));
    assert!(super::performance::performance_client(broken()).is_err());
    assert!(super::disconnect::revocation_client(reqwest::Client::builder()).is_ok());
    assert!(super::performance::performance_client(reqwest::Client::builder()).is_ok());
}
