use super::{
    fixture::MemoryStore,
    profiles::{delete_profile, load_profile, save_profile},
    types::*,
};

#[test]
fn profile_round_trip_is_scoped_preserves_credentials_and_delete_is_idempotent() {
    let store = MemoryStore::default();
    let headers = vec![CrawlProfileHeader {
        name: "Authorization".into(),
        value: "Bearer synthetic".into(),
    }];
    save_profile(
        "p-1",
        "profile-1",
        headers,
        Some("session=synthetic".into()),
        Some("https://user:synthetic@proxy.example:8443".into()),
        &store,
    )
    .unwrap();
    let profile = load_profile("p-1", "profile-1", &store).unwrap();
    assert_eq!(profile.headers[0].value, "Bearer synthetic");
    assert_eq!(profile.cookie.as_deref(), Some("session=synthetic"));
    assert_eq!(
        profile.proxy_url.as_deref(),
        Some("https://user:synthetic@proxy.example:8443")
    );
    assert!(load_profile("p-2", "profile-1", &store).is_err());
    delete_profile("p-1", "profile-1", &store).unwrap();
    delete_profile("p-1", "profile-1", &store).unwrap();
    assert!(load_profile("p-1", "profile-1", &store).is_err());
}

#[test]
fn blank_optional_fields_are_normalized_and_invalid_inputs_never_write() {
    let store = MemoryStore::default();
    save_profile(
        "p",
        "profile",
        vec![],
        Some(" \t".into()),
        Some(" \n".into()),
        &store,
    )
    .unwrap();
    let profile = load_profile("p", "profile", &store).unwrap();
    assert!(profile.cookie.is_none() && profile.proxy_url.is_none());
    store.calls.borrow_mut().clear();
    assert!(save_profile("p/../other", "profile", vec![], None, None, &store).is_err());
    assert!(save_profile(
        "p",
        "profile",
        vec![CrawlProfileHeader {
            name: "Host".into(),
            value: "private".into()
        }],
        None,
        None,
        &store
    )
    .is_err());
    assert!(delete_profile("p", "profile_extra", &store).is_err());
    assert!(load_profile("", "profile", &store).is_err());
    assert!(super::crawl_auth_profile("", "profile").is_err());
    assert!(store.calls.borrow().is_empty());
}

#[test]
fn malformed_saved_profiles_and_storage_failures_never_return_a_usable_profile() {
    let store = MemoryStore::default();
    for raw in [
        "synthetic-private",
        "null",
        r#"{"headers":[{"name":"Host","value":"private"}]}"#,
    ] {
        store.seed("crawl_auth_p_profile", raw);
        let error = load_profile("p", "profile", &store).unwrap_err();
        assert!(!error.contains("synthetic-private"));
    }
    let failed = MemoryStore {
        failed: true,
        ..Default::default()
    };
    assert!(load_profile("p", "profile", &failed)
        .unwrap_err()
        .contains("not available"));
    assert!(save_profile("p", "profile", vec![], None, None, &failed)
        .unwrap_err()
        .contains("Unable to save"));
    assert!(delete_profile("p", "profile", &failed)
        .unwrap_err()
        .contains("Unable to remove"));
}

#[tokio::test]
async fn public_profile_commands_validate_before_native_storage_access() {
    assert!(super::save_crawl_auth_profile(
        "p".into(),
        "profile".into(),
        vec![CrawlProfileHeader {
            name: "Host".into(),
            value: "private".into()
        }],
        None,
        None
    )
    .await
    .is_err());
    assert!(
        super::delete_crawl_auth_profile("../p".into(), "profile".into())
            .await
            .is_err()
    );
}
