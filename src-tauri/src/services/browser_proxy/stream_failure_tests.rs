use super::server::serve_streams;
use std::{
    io::Cursor,
    pin::Pin,
    sync::{Arc, Mutex},
    task::{Context, Poll},
    time::Duration,
};
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};

/// In-memory stream that serves canned input and fails writes after a budget.
struct Scripted {
    input: Cursor<Vec<u8>>,
    output: Arc<Mutex<Vec<u8>>>,
    writes_before_failure: usize,
}

impl Scripted {
    fn new(input: &[u8], writes_before_failure: usize) -> (Self, Arc<Mutex<Vec<u8>>>) {
        let output = Arc::new(Mutex::new(Vec::new()));
        let stream = Self {
            input: Cursor::new(input.to_vec()),
            output: Arc::clone(&output),
            writes_before_failure,
        };
        (stream, output)
    }
}

impl AsyncRead for Scripted {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.input).poll_read(cx, buf)
    }
}

impl AsyncWrite for Scripted {
    fn poll_write(
        mut self: Pin<&mut Self>,
        _: &mut Context<'_>,
        bytes: &[u8],
    ) -> Poll<std::io::Result<usize>> {
        if self.writes_before_failure == 0 {
            return Poll::Ready(Err(std::io::Error::other("write failed")));
        }
        self.writes_before_failure -= 1;
        self.output.lock().unwrap().extend_from_slice(bytes);
        Poll::Ready(Ok(bytes.len()))
    }

    fn poll_flush(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        Poll::Ready(Ok(()))
    }

    fn poll_shutdown(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        Poll::Ready(Ok(()))
    }
}

const SHORT: Duration = Duration::from_millis(200);

#[tokio::test]
async fn connect_stops_when_the_tunnel_acknowledgement_cannot_be_written() {
    let (client, output) = Scripted::new(b"CONNECT example.com:443 HTTP/1.1\r\n\r\n", 0);
    serve_streams(
        client,
        |_, _| async { Ok(Scripted::new(b"", 1).0) },
        SHORT,
        SHORT,
    )
    .await;
    assert!(output.lock().unwrap().is_empty());
}

#[tokio::test]
async fn http_forwarding_reports_a_bad_gateway_when_the_upstream_write_fails() {
    let request = b"GET http://example.com/ HTTP/1.1\r\nHost: example.com\r\n\r\n";
    let (client, output) = Scripted::new(request, 8);
    serve_streams(
        client,
        |_, _| async { Ok(Scripted::new(b"", 0).0) },
        SHORT,
        SHORT,
    )
    .await;
    let response = String::from_utf8(output.lock().unwrap().clone()).unwrap();
    assert!(response.starts_with("HTTP/1.1 502"), "{response}");
}
