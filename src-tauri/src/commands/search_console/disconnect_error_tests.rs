use super::{disconnect_search_console_at, disconnect_search_console_internal};

#[tokio::test]
async fn disconnect_search_console_reports_client_secret_deletion_error() {
    let err = disconnect_search_console_internal(
        "valid-project",
        "http://127.0.0.1/revoke",
        |_| Err("mock keychain delete failure".into()),
        |_| Ok(None),
    )
    .await
    .unwrap_err();
    assert_eq!(
        err,
        "Unable to remove the Search Console client secret: mock keychain delete failure"
    );
}

#[tokio::test]
async fn disconnect_search_console_reports_token_read_error() {
    let err = disconnect_search_console_internal(
        "valid-project",
        "http://127.0.0.1/revoke",
        |_| Ok(()),
        |_| Err("mock keychain read failure".into()),
    )
    .await
    .unwrap_err();
    assert_eq!(
        err,
        "Unable to read the Search Console token: mock keychain read failure"
    );
}

#[tokio::test]
async fn disconnect_search_console_reports_token_deletion_error() {
    let mut call_count = 0;
    let err = disconnect_search_console_internal(
        "valid-project",
        "http://127.0.0.1/revoke",
        move |_| {
            call_count += 1;
            if call_count == 1 {
                Ok(())
            } else {
                Err("mock token delete failure".into())
            }
        },
        |_| Ok(Some("token".into())),
    )
    .await
    .unwrap_err();
    assert_eq!(
        err,
        "Unable to remove the Search Console token from the credential store: mock token delete failure"
    );
}

#[tokio::test]
async fn disconnect_search_console_at_rejects_empty_project() {
    let err = disconnect_search_console_at("", "http://127.0.0.1/revoke")
        .await
        .unwrap_err();
    assert_eq!(err, "Invalid Google Search Console project identifier.");
}
