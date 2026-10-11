use super::fetch_public_feed;

#[tokio::test]
async fn fetch_public_feed_rejects_empty_and_invalid_arguments() {
    assert_eq!(
        fetch_public_feed("".into(), "PL".into(), "seo".into(), "pl".into())
            .await
            .unwrap_err(),
        "Unsupported public feed."
    );
    assert_eq!(
        fetch_public_feed("google-trends".into(), "".into(), "".into(), "pl".into())
            .await
            .unwrap_err(),
        "Public feed requires a two-letter country."
    );
    assert_eq!(
        fetch_public_feed("google-trends".into(), "PL".into(), "".into(), "".into())
            .await
            .unwrap_err(),
        "Public feed requires a valid language."
    );
}
