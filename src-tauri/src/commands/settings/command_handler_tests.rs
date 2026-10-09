use super::*;
use crate::utils::test_app::StorageApp;
use tauri::test::mock_builder;

#[tokio::test]
async fn auth_profile_commands_validate_and_execute_lifecycle() {
    let headers = vec![
        CrawlProfileHeader {
            name: "Authorization".into(),
            value: "Bearer token123".into(),
        },
        CrawlProfileHeader {
            name: "X-Custom-Audit".into(),
            value: "seomi-test".into(),
        },
    ];

    let save_res = save_crawl_auth_profile(
        "test-proj-1".into(),
        "staging-profile".into(),
        headers,
        Some("session=abc".into()),
        None,
    )
    .await;
    assert!(save_res.is_ok());

    let del_res = delete_crawl_auth_profile("test-proj-1".into(), "staging-profile".into()).await;
    assert!(del_res.is_ok());

    let bad_proj =
        save_crawl_auth_profile("invalid/proj".into(), "prof".into(), vec![], None, None).await;
    assert!(bad_proj.is_err());

    let bad_prof =
        save_crawl_auth_profile("proj".into(), "../prof".into(), vec![], None, None).await;
    assert!(bad_prof.is_err());

    let bad_proxy = save_crawl_auth_profile(
        "proj".into(),
        "prof".into(),
        vec![],
        None,
        Some("invalid-proxy-url".into()),
    )
    .await;
    assert!(bad_proxy.is_err());
}

#[tokio::test]
async fn secret_commands_validate_names_and_read_write() {
    let key = "claude_api_key";
    let val = "sk-ant-api03-synthetic-secret-value";

    let write_res = set_secret(key.into(), val.into()).await;
    assert!(write_res.is_ok());

    let read_res = get_secret(key.into()).await.unwrap();
    assert_eq!(read_res.as_deref(), Some(val));
    secure_store::secret_entry(key)
        .unwrap()
        .delete_credential()
        .unwrap();
    assert_eq!(get_secret(key.into()).await.unwrap(), None);

    assert!(get_secret("invalid key with spaces".into()).await.is_err());
    assert!(set_secret("invalid key with spaces".into(), "val".into())
        .await
        .is_err());
}

#[tokio::test]
async fn config_commands_validate_and_roundtrip_persisted_state() {
    let app = StorageApp::new(mock_builder());
    let handle = app.handle();

    let initial = get_config(handle.clone()).await.unwrap();
    assert_eq!(initial.theme, "dark");

    let mut updated = initial.clone();
    updated.language = "pl".into();
    updated.request_timeout_secs = 45;
    updated.default_user_agent = "SEOmi-Tester/2.0".into();

    let save_res = save_config(handle.clone(), updated.clone()).await;
    assert!(save_res.is_ok());

    let reloaded = get_config(handle.clone()).await.unwrap();
    assert_eq!(reloaded.language, "pl");
    assert_eq!(reloaded.request_timeout_secs, 45);
    assert_eq!(reloaded.default_user_agent, "SEOmi-Tester/2.0");

    let mut invalid = updated;
    invalid.theme = "nonexistent-theme".into();
    let invalid_res = save_config(handle.clone(), invalid).await;
    assert!(invalid_res.is_err());
}
