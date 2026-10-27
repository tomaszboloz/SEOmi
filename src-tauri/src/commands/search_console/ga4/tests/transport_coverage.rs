use super::super::transport::{api_endpoint, get_json, post_json};
use serde_json::json;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;

async fn serve_status(status: u16, body: &'static str) -> (String, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let addr = format!("http://{}", listener.local_addr().unwrap());
    let handle = tokio::spawn(async move {
        if let Ok((mut stream, _)) = listener.accept().await {
            let _ = super::http_fixture::read_request(&mut stream).await;
            let resp = format!(
                "HTTP/1.1 {status} Error\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(resp.as_bytes()).await.unwrap();
            stream.shutdown().await.unwrap();
        }
    });
    (addr, handle)
}

#[tokio::test]
async fn get_json_network_failure_and_non_200_status() {
    let client = super::http_fixture::test_client();
    let err = get_json(
        &client,
        "token",
        "http://127.0.0.1:1/nonexistent",
        &[],
        "GA Admin API",
    )
    .await
    .unwrap_err();
    assert_eq!(err, "GA Admin API request failed.");

    let (addr, handle) = serve_status(403, r#"{"error":{"message":"Forbidden"}}"#).await;
    let err = get_json(&client, "token", &addr, &[], "GA Admin API")
        .await
        .unwrap_err();
    assert!(err.contains("403") || err.contains("Forbidden") || err.contains("GA Admin API"));
    handle.await.unwrap();
}

#[tokio::test]
async fn post_json_network_failure_and_non_200_status() {
    let client = super::http_fixture::test_client();
    let payload = json!({"test": "data"});
    let err = post_json(
        &client,
        "token",
        "http://127.0.0.1:1/nonexistent",
        &payload,
        "GA Data API",
    )
    .await
    .unwrap_err();
    assert_eq!(err, "GA Data API request failed.");

    let (addr, handle) = serve_status(500, r#"{"error":{"message":"Internal error"}}"#).await;
    let err = post_json(&client, "token", &addr, &payload, "GA Data API")
        .await
        .unwrap_err();
    assert!(err.contains("500") || err.contains("Internal error") || err.contains("GA Data API"));
    handle.await.unwrap();
}

#[test]
fn api_endpoint_formatting_edges() {
    let ep1 = api_endpoint(
        "https://analyticsadmin.googleapis.com/v1beta",
        "accountSummaries",
    );
    assert_eq!(
        ep1,
        "https://analyticsadmin.googleapis.com/v1beta/accountSummaries"
    );

    let ep2 = api_endpoint(
        "https://analyticsadmin.googleapis.com/v1beta/",
        "accountSummaries",
    );
    assert_eq!(
        ep2,
        "https://analyticsadmin.googleapis.com/v1beta/accountSummaries"
    );

    let ep3 = api_endpoint("https://analyticsadmin.googleapis.com", "accountSummaries");
    assert_eq!(
        ep3,
        "https://analyticsadmin.googleapis.com/v1beta/accountSummaries"
    );

    let ep4 = api_endpoint("https://analyticsadmin.googleapis.com/", "accountSummaries");
    assert_eq!(
        ep4,
        "https://analyticsadmin.googleapis.com/v1beta/accountSummaries"
    );
}
