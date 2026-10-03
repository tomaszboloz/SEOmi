use super::{http::read_request, models::*};
use crate::utils::test_io::Packets;

async fn parse(bytes: &[u8]) -> Result<HttpRequest, String> {
    read_request(&mut Packets([Ok(bytes.to_vec())].into())).await
}

fn header_with_length(length: usize) -> Vec<u8> {
    let start = b"GET /health HTTP/1.1\r\nX-Pad: ";
    let mut header = start.to_vec();
    header.resize(length - 4, b'x');
    header.extend_from_slice(b"\r\n\r\n");
    header
}

#[tokio::test]
async fn header_limit_includes_terminator_across_packet_boundaries() {
    let exact = header_with_length(MAX_HEADER_BYTES);
    assert_eq!(parse(&exact).await.unwrap().path, "/health");
    let oversized = header_with_length(MAX_HEADER_BYTES + 1);
    let packets = [
        Ok(oversized[..MAX_HEADER_BYTES - 4].to_vec()),
        Ok(oversized[MAX_HEADER_BYTES - 4..].to_vec()),
    ];
    let error = read_request(&mut Packets(packets.into()))
        .await
        .unwrap_err();
    assert_eq!(error, "Worker request headers exceed the safety limit.");
}

#[tokio::test]
async fn request_line_rejects_extra_parts_and_non_http_versions() {
    for line in [
        "GET /health HTTP/1.1 extra",
        "GET /health arbitrary",
        "GET /health HTTP/2.0",
    ] {
        assert_eq!(
            parse(format!("{line}\r\n\r\n").as_bytes())
                .await
                .unwrap_err(),
            "Worker request line is invalid."
        );
    }
}

#[tokio::test]
async fn header_names_must_be_http_tokens_without_whitespace() {
    for name in [
        "X Header",
        " X-Header",
        "X-Header ",
        "X@Header",
        "X\0Header",
    ] {
        assert_eq!(
            parse(format!("GET /health HTTP/1.1\r\n{name}: value\r\n\r\n").as_bytes())
                .await
                .unwrap_err(),
            "Worker request header is invalid."
        );
    }
}
