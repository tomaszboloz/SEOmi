use super::{
    fixture::MemoryStore,
    secret_commands::{read_secret, write_secret},
};

#[test]
fn secure_settings_preserve_values_delete_blank_values_and_report_missing_honestly() {
    let store = MemoryStore::default();
    for name in [
        "openai_api_key",
        "claude_api_key",
        "gemini_api_key",
        "gsc_client_secret_project-1",
    ] {
        assert_eq!(read_secret(name, &store).unwrap(), None);
        write_secret(name, " synthetic-token żółć ", &store).unwrap();
        assert_eq!(
            read_secret(name, &store).unwrap().as_deref(),
            Some(" synthetic-token żółć ")
        );
        write_secret(name, " \n\t", &store).unwrap();
        assert_eq!(read_secret(name, &store).unwrap(), None);
        write_secret(name, "", &store).unwrap();
    }
}

#[test]
fn invalid_names_and_refresh_tokens_never_access_the_store() {
    let store = MemoryStore::default();
    for name in [
        "gsc_refresh_token_project-1",
        "openai_api_key/../other",
        "",
        "unknown",
        "crawl_auth_p_p_extra",
    ] {
        assert!(read_secret(name, &store).is_err());
        assert!(write_secret(name, "synthetic-token", &store).is_err());
    }
    assert!(store.calls.borrow().is_empty());
    assert!(super::secure_store::secret_entry("unsupported").is_err());
}

#[test]
fn secure_store_failures_have_local_errors_and_preserve_existing_values() {
    let store = MemoryStore {
        failed: true,
        ..Default::default()
    };
    store.seed("openai_api_key", "preserved");
    assert_eq!(
        read_secret("openai_api_key", &store).unwrap_err(),
        "Unable to read secure setting."
    );
    assert_eq!(
        write_secret("openai_api_key", "replacement", &store).unwrap_err(),
        "Unable to save secure setting."
    );
    assert_eq!(
        write_secret("openai_api_key", "", &store).unwrap_err(),
        "Unable to remove secure setting."
    );
    assert_eq!(store.values.borrow()["openai_api_key"], "preserved");
}

#[tokio::test]
async fn public_secret_commands_reject_native_tokens_and_unknown_names_before_keychain_access() {
    for name in ["gsc_refresh_token_project-1", "unknown"] {
        assert!(super::get_secret(name.into()).await.is_err());
        assert!(super::set_secret(name.into(), "synthetic".into())
            .await
            .is_err());
    }
}
