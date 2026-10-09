use super::callback::receive_oauth_code;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    time::{timeout, Duration},
};

async fn request(address: std::net::SocketAddr, path: &str) -> String {
    let mut stream = TcpStream::connect(address).await.unwrap();
    stream
        .write_all(format!("GET {path} HTTP/1.1\r\nHost: localhost\r\n\r\n").as_bytes())
        .await
        .unwrap();
    let mut response = String::new();
    timeout(Duration::from_secs(1), stream.read_to_string(&mut response))
        .await
        .unwrap()
        .unwrap();
    response
}

#[tokio::test]
async fn unrelated_routes_wrong_states_and_incomplete_requests_do_not_consume_login() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move { receive_oauth_code(listener, "expected").await });
    assert!(request(address, "/favicon.ico")
        .await
        .starts_with("HTTP/1.1 404"));
    assert!(request(address, "/oauth2callback?state=wrong&code=bad")
        .await
        .starts_with("HTTP/1.1 400"));
    let mut incomplete = TcpStream::connect(address).await.unwrap();
    incomplete.write_all(b"GET /oauth").await.unwrap();
    incomplete.shutdown().await.unwrap();
    let mut response = String::new();
    incomplete.read_to_string(&mut response).await.unwrap();
    assert!(response.starts_with("HTTP/1.1 400"));
    assert!(
        request(address, "/oauth2callback?state=expected&code=a%2Bb")
            .await
            .starts_with("HTTP/1.1 200")
    );
    assert_eq!(
        timeout(Duration::from_secs(1), task)
            .await
            .unwrap()
            .unwrap()
            .unwrap(),
        "a+b"
    );
}

#[tokio::test]
async fn cancellation_and_provider_failure_return_distinct_errors() {
    for (error, expected) in [
        ("access_denied", "cancelled by the user"),
        ("server_error", "Google OAuth failed: server_error"),
        (
            "redirect_uri_mismatch",
            "Use an OAuth client of type Desktop app",
        ),
        ("synthetic-secret%0Amalicious-error", "Google OAuth failed."),
    ] {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move { receive_oauth_code(listener, "s").await });
        assert!(
            request(address, &format!("/oauth2callback?state=s&error={error}"))
                .await
                .starts_with("HTTP/1.1 400")
        );
        let message = timeout(Duration::from_secs(1), task)
            .await
            .unwrap()
            .unwrap()
            .unwrap_err();
        assert!(message.contains(expected), "{message}");
        assert!(!message.contains("synthetic-secret"));
        assert!(!message.contains("malicious-error"));
    }
}

#[tokio::test]
async fn absent_or_empty_codes_are_rejected() {
    for suffix in ["", "&code="] {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move { receive_oauth_code(listener, "s").await });
        request(address, &format!("/oauth2callback?state=s{suffix}")).await;
        assert_eq!(
            timeout(Duration::from_secs(1), task)
                .await
                .unwrap()
                .unwrap()
                .unwrap_err(),
            "Google did not return an authorization code."
        );
    }
}
