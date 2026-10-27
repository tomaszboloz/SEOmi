use super::*;

#[tokio::test]
async fn inspect_url_command_handler_validates_url_and_credentials() {
    assert!(inspect_search_console_url(
        VALID_PROJ.into(),
        VALID_CLIENT.into(),
        "sc-domain:example.test".into(),
        "ftp://invalid-scheme.test".into(),
    )
    .await
    .is_err());

    assert!(inspect_search_console_url(
        VALID_PROJ.into(),
        VALID_CLIENT.into(),
        "sc-domain:example.test".into(),
        "".into(),
    )
    .await
    .is_err());

    let res = inspect_search_console_url(
        VALID_PROJ.into(),
        VALID_CLIENT.into(),
        "sc-domain:example.test".into(),
        "https://example.test/landing".into(),
    )
    .await;
    assert!(res.is_err());
}
