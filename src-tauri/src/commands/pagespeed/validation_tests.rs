use super::{target_url, validate_form_factor, validate_strategy};
#[test]
fn accepts_only_supported_strategies_and_crux_form_factors() {
    assert_eq!(validate_strategy("mobile").unwrap(), "mobile");
    assert_eq!(validate_strategy("desktop").unwrap(), "desktop");
    assert!(validate_strategy("tablet").is_err());
    assert_eq!(validate_form_factor("PHONE").unwrap(), "PHONE");
    assert_eq!(validate_form_factor("DESKTOP").unwrap(), "DESKTOP");
    assert_eq!(validate_form_factor("TABLET").unwrap(), "TABLET");
    assert!(validate_form_factor("MOBILE").is_err());
}
#[test]
fn validates_external_targets_and_strips_fragments() {
    assert_eq!(
        target_url("https://example.com/page#section")
            .unwrap()
            .as_str(),
        "https://example.com/page"
    );
    assert!(target_url("http://127.0.0.1/private").is_err());
    assert!(target_url("https://user:password@example.com").is_err());
}

#[test]
fn project_and_credential_validation_rejects_invalid_scope_before_reading_secrets() {
    use super::validation::{google_metrics_key, google_metrics_key_with, validate_project_id};
    for value in ["", "a/b", "ż", " ", "a.b"] {
        assert!(validate_project_id(value).is_err());
        assert!(google_metrics_key(value).is_err());
        assert!(google_metrics_key_with(value, |_| panic!("invalid scope read a secret")).is_err());
    }
    assert!(validate_project_id(&"a".repeat(81)).is_err());
    assert!(validate_project_id(&"a".repeat(80)).is_ok());
    assert_eq!(
        google_metrics_key_with("project-one", |name| {
            assert_eq!(name, "google_metrics_api_key_project-one");
            Ok("synthetic-key".into())
        })
        .unwrap(),
        "synthetic-key"
    );
    assert!(google_metrics_key_with("project-one", |_| Ok(" ".into())).is_err());
    assert_eq!(
        google_metrics_key_with("project-one", |_| Err("fixture storage failure".into()))
            .unwrap_err(),
        "fixture storage failure"
    );
    assert!(target_url(&"a".repeat(4097)).is_err());
}
