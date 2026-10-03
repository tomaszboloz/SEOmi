use super::http::{bearer_matches, json_error, write_response};
use std::{
    io,
    pin::Pin,
    sync::Arc,
    task::{Context, Poll},
};
use tokio::{
    io::{AsyncReadExt, AsyncWrite},
    net::{TcpListener, TcpStream},
    sync::Mutex,
};

#[tokio::test]
async fn responses_preserve_status_reason_binary_bytes_and_no_store_on_real_tcp() {
    for (status, reason) in [
        (200, "OK"),
        (400, "Bad Request"),
        (401, "Unauthorized"),
        (404, "Not Found"),
        (410, "Gone"),
        (413, "Payload Too Large"),
        (415, "Unsupported Media Type"),
        (422, "Unprocessable Entity"),
        (426, "Upgrade Required"),
        (500, "Error"),
    ] {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let mut client = TcpStream::connect(listener.local_addr().unwrap())
            .await
            .unwrap();
        let (mut server, _) = listener.accept().await.unwrap();
        let body = [0, 255, 1];
        let expected = format!("HTTP/1.1 {status} {reason}\r\nContent-Type: application/octet-stream\r\nContent-Length: 3\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n").into_bytes();
        let (sent, received) = tokio::join!(
            write_response(&mut server, status, "application/octet-stream", &body),
            async {
                let mut bytes = Vec::new();
                client.read_to_end(&mut bytes).await.unwrap();
                bytes
            }
        );
        sent.unwrap();
        assert_eq!(&received[..expected.len()], expected);
        assert_eq!(&received[expected.len()..], body);
    }
}

struct FailingWriter {
    successful_writes: usize,
}

impl AsyncWrite for FailingWriter {
    fn poll_write(
        mut self: Pin<&mut Self>,
        _: &mut Context<'_>,
        bytes: &[u8],
    ) -> Poll<io::Result<usize>> {
        if self.successful_writes == 0 {
            Poll::Ready(Err(io::Error::other("injected write failure")))
        } else {
            self.successful_writes -= 1;
            Poll::Ready(Ok(bytes.len()))
        }
    }
    fn poll_flush(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Ok(()))
    }
    fn poll_shutdown(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Err(io::Error::other("shutdown already closed")))
    }
}

#[tokio::test]
async fn response_reports_header_and_body_write_errors_but_allows_already_closed_shutdown() {
    for successful_writes in [0, 1] {
        let mut writer = FailingWriter { successful_writes };
        assert_eq!(
            write_response(&mut writer, 200, "application/json", b"{}")
                .await
                .unwrap_err(),
            "injected write failure"
        );
    }
    let mut writer = FailingWriter {
        successful_writes: 2,
    };
    write_response(&mut writer, 200, "application/json", b"{}")
        .await
        .unwrap();
}

#[test]
fn json_errors_escape_quotes_unicode_and_control_characters() {
    let message = "żółć\n\"quoted\"\0";
    let value: serde_json::Value = serde_json::from_slice(&json_error(message)).unwrap();
    assert_eq!(value, serde_json::json!({"error":message}));
}

#[tokio::test]
async fn bearer_rejections_do_not_consume_token_and_concurrent_valid_claim_has_one_winner() {
    let token = Arc::new(Mutex::new(Some("one-shot".to_string())));
    for candidate in [
        None,
        Some("bearer one-shot"),
        Some("Bearer other"),
        Some("Bearer one-shot "),
    ] {
        assert!(!bearer_matches(candidate, &token).await);
        assert_eq!(token.lock().await.as_deref(), Some("one-shot"));
    }
    let (left, right) = tokio::join!(
        bearer_matches(Some("Bearer one-shot"), &token),
        bearer_matches(Some("Bearer one-shot"), &token)
    );
    assert_ne!(left, right);
    assert!(token.lock().await.is_none());
    assert!(!bearer_matches(Some("Bearer one-shot"), &token).await);
}
