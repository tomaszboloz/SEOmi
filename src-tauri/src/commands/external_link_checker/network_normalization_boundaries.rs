use super::*;

#[tokio::test]
async fn checked_public_addresses_with_handles_all_host_forms() {
    let u4 = Url::parse("https://8.8.8.8:443/").unwrap();
    assert_eq!(
        super::checked_public_addresses_with(&u4, |_, _| async { unreachable!() })
            .await
            .unwrap(),
        vec!["8.8.8.8:443".parse().unwrap()]
    );
    let u6 = Url::parse("https://[2001:4860:4860::8888]:443/").unwrap();
    assert_eq!(
        super::checked_public_addresses_with(&u6, |_, _| async { unreachable!() })
            .await
            .unwrap(),
        vec!["[2001:4860:4860::8888]:443".parse().unwrap()]
    );
    let p4 = Url::parse("https://127.0.0.1:443/").unwrap();
    assert!(
        super::checked_public_addresses_with(&p4, |_, _| async { unreachable!() })
            .await
            .is_err()
    );
    let p6 = Url::parse("https://[::1]:443/").unwrap();
    assert!(
        super::checked_public_addresses_with(&p6, |_, _| async { unreachable!() })
            .await
            .is_err()
    );
    let no_host = Url::parse("data:text/plain,hello").unwrap();
    assert_eq!(
        super::checked_public_addresses_with(&no_host, |_, _| async { unreachable!() })
            .await
            .unwrap_err(),
        "URL has no host"
    );
    let no_port = Url::parse("gopher://example.test").unwrap();
    assert_eq!(
        super::checked_public_addresses_with(&no_port, |_, _| async { unreachable!() })
            .await
            .unwrap_err(),
        "URL has no HTTP port"
    );
}

#[tokio::test]
async fn check_one_with_gates_handles_blocked_and_invalid_urls() {
    let gates = Arc::new(std::sync::Mutex::new(std::collections::HashMap::new()));
    let res = super::check_one_with_gates("https://user:pass@example.com/".into(), gates).await;
    assert_eq!(res.request_error_kind.as_deref(), Some("invalid"));
}

#[test]
fn normalize_external_url_rejects_credentials_and_strips_fragments() {
    assert!(normalize_external_url("not a valid url").is_err());
    assert!(normalize_external_url("   ").is_err());
    assert!(normalize_external_url("https://:password@example.com/").is_err());
    let stripped = normalize_external_url("https://example.com/page#section").unwrap();
    assert_eq!(stripped.fragment(), None);
    assert_eq!(stripped.as_str(), "https://example.com/page");
}
