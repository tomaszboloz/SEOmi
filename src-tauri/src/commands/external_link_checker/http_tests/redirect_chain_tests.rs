use super::*;

#[tokio::test]
async fn follows_valid_redirects_and_reports_the_final_status_and_target() {
    let server = Server::new(vec![
        response(301, Some(b"/step-one")),
        response(302, Some(b"/final")),
        response(200, None),
    ])
    .await;
    let expected_final = server.url.join("/final").unwrap().to_string();
    let result = server.check().await;

    assert_eq!(result.http_status, Some(200));
    assert_eq!(
        result.redirect_url.as_deref(),
        Some(expected_final.as_str())
    );
    assert!(result.request_error_kind.is_none());
    assert_eq!(server.requests().await.len(), 3);
}

#[tokio::test]
async fn rejects_an_unsafe_redirect_without_requesting_the_private_target() {
    let server = Server::new(vec![response(302, Some(b"http://127.0.0.1/private"))]).await;
    let result = server.check().await;

    assert_eq!(result.http_status, Some(302));
    assert_eq!(result.redirect_url, None);
    assert_eq!(result.request_error_kind.as_deref(), Some("unverifiable"));
    assert_eq!(server.requests().await.len(), 1);
}
