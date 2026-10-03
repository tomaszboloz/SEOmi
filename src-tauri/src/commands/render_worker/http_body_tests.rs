use super::{http::read_request, models::*};
use crate::utils::test_io::Packets;

async fn parse(bytes: &[u8]) -> Result<HttpRequest, String> {
    read_request(&mut Packets([Ok(bytes.to_vec())].into())).await
}

#[tokio::test]
async fn request_reader_preserves_binary_body_and_case_insensitive_headers() {
    let packets = [
        Ok(b"POST /v1/render HTTP/1.0\r\nContent-Length: 4\r\nX-TEST:\tvalue \r\n\r\n".to_vec()),
        Ok(vec![0, 255, 1, 2]),
    ];
    let result = read_request(&mut Packets(packets.into())).await.unwrap();
    assert_eq!(result.method, "POST");
    assert_eq!(result.path, "/v1/render");
    assert_eq!(result.headers["x-test"], "value");
    assert_eq!(result.body, [0, 255, 1, 2]);
    let empty = parse(b"GET /health HTTP/1.1\r\n\r\n").await.unwrap();
    assert!(empty.headers.is_empty());
    assert!(empty.body.is_empty());
}

#[tokio::test]
async fn body_accepts_exact_byte_cap_and_rejects_oversize_before_reading() {
    let mut bytes = format!("POST /v1/render HTTP/1.1\r\nContent-Length: {MAX_BODY_BYTES}\r\n\r\n")
        .into_bytes();
    bytes.resize(bytes.len() + MAX_BODY_BYTES, b'x');
    assert_eq!(
        parse(&bytes).await.unwrap().body,
        vec![b'x'; MAX_BODY_BYTES]
    );
    let oversized = format!(
        "POST /v1/render HTTP/1.1\r\nContent-Length: {}\r\n\r\n",
        MAX_BODY_BYTES + 1
    );
    assert_eq!(
        parse(oversized.as_bytes()).await.unwrap_err(),
        "Worker request body exceeds the safety limit."
    );
}

#[tokio::test]
async fn malformed_headers_and_content_lengths_are_rejected() {
    for (headers, expected) in [
        ("Missing-colon", "Worker request header is invalid."),
        (
            ": empty",
            "Worker request contains duplicate or empty headers.",
        ),
        (
            "X-Test: a\r\nx-test: b",
            "Worker request contains duplicate or empty headers.",
        ),
        (
            "Transfer-Encoding: chunked",
            "Chunked worker requests are not supported.",
        ),
        ("Content-Length: -1", "Worker content-length is invalid."),
        ("Content-Length: no", "Worker content-length is invalid."),
        ("X-Test: bad\u{007f}", "Worker request header is invalid."),
    ] {
        let bytes = format!("POST /v1/render HTTP/1.1\r\n{headers}\r\n\r\n");
        assert_eq!(parse(bytes.as_bytes()).await.unwrap_err(), expected);
    }
}

#[tokio::test]
async fn malformed_request_lines_are_rejected() {
    for line in [
        "",
        "GET",
        "GET /",
        "ABCDEFGHIJKLMNOPQ / HTTP/1.1",
        "GE\u{0001}T / HTTP/1.1",
        "GET /bad\u{0001}path HTTP/1.1",
    ] {
        assert_eq!(
            parse(format!("{line}\r\n\r\n").as_bytes())
                .await
                .unwrap_err(),
            "Worker request line is invalid."
        );
    }
    let line = format!("GET /{} HTTP/1.1\r\n\r\n", "x".repeat(2048));
    assert_eq!(
        parse(line.as_bytes()).await.unwrap_err(),
        "Worker request line is invalid."
    );
}

#[tokio::test]
async fn truncation_encoding_and_io_failures_return_specific_errors() {
    for (bytes, expected) in [
        (
            &b"GET /"[..],
            "Worker request ended before headers were complete.",
        ),
        (
            &b"\xff\r\n\r\n"[..],
            "Worker request headers are not UTF-8.",
        ),
        (
            &b"POST / HTTP/1.1\r\nContent-Length: 2\r\n\r\nx"[..],
            "Worker request ended before the body was complete.",
        ),
    ] {
        assert_eq!(parse(bytes).await.unwrap_err(), expected);
    }
    assert_eq!(
        parse(&vec![b'x'; MAX_HEADER_BYTES]).await.unwrap_err(),
        "Worker request headers exceed the safety limit."
    );
    for prefix in [
        None,
        Some(b"POST / HTTP/1.1\r\nContent-Length: 2\r\n\r\n".to_vec()),
    ] {
        let mut packets = std::collections::VecDeque::new();
        if let Some(prefix) = prefix {
            packets.push_back(Ok(prefix));
        }
        packets.push_back(Err(std::io::Error::other("injected read failure")));
        assert_eq!(
            read_request(&mut Packets(packets)).await.unwrap_err(),
            "injected read failure"
        );
    }
}
