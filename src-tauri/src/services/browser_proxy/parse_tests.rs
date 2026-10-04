use super::{
    parse::read_request,
    types::{ProxyTarget, MAX_HEADER_BYTES},
};
use crate::utils::test_io::Packets;

fn header(length: usize) -> Vec<u8> {
    let mut bytes = b"GET http://example.test/ HTTP/1.1\r\nX-Pad: ".to_vec();
    bytes.resize(length - 4, b'x');
    bytes.extend_from_slice(b"\r\n\r\n");
    bytes
}

#[tokio::test]
async fn proxy_header_limit_includes_split_terminator() {
    let exact = header(MAX_HEADER_BYTES);
    let parsed = read_request(&mut Packets([Ok(exact)].into()))
        .await
        .unwrap();
    assert!(matches!(parsed.target, ProxyTarget::Http { .. }));
    assert!(parsed.body.is_empty());
    let oversized = header(MAX_HEADER_BYTES + 1);
    let packets = [
        Ok(oversized[..MAX_HEADER_BYTES - 4].to_vec()),
        Ok(oversized[MAX_HEADER_BYTES - 4..].to_vec()),
    ];
    assert_eq!(
        read_request(&mut Packets(packets.into())).await.err(),
        Some(431)
    );
}

#[tokio::test]
async fn proxy_reader_distinguishes_truncation_oversize_and_io_failures() {
    for bytes in [
        b"GET /".to_vec(),
        vec![b'x'; MAX_HEADER_BYTES],
        b"\xff\r\n\r\n".to_vec(),
    ] {
        assert!(read_request(&mut Packets([Ok(bytes)].into()))
            .await
            .is_err());
    }
    let error = std::io::Error::other("injected header read failure");
    assert_eq!(
        read_request(&mut Packets([Err(error)].into())).await.err(),
        Some(400)
    );
    let truncated = b"GET http://example.test/ HTTP/1.1\r\nContent-Length: 2\r\n\r\nx".to_vec();
    assert_eq!(
        read_request(&mut Packets([Ok(truncated)].into()))
            .await
            .err(),
        Some(400)
    );
    let body_read_error = [
        Ok(b"GET http://example.test/ HTTP/1.1\r\nContent-Length: 2\r\n\r\n".to_vec()),
        Err(std::io::Error::other("injected body read failure")),
    ];
    assert_eq!(
        read_request(&mut Packets(body_read_error.into()))
            .await
            .err(),
        Some(400)
    );
    let extra = b"GET http://example.test/ HTTP/1.1\r\n\r\nextra".to_vec();
    assert_eq!(
        read_request(&mut Packets([Ok(extra)].into())).await.err(),
        Some(400)
    );
    let packets = [
        Ok(b"GET http://example.test/ HTTP/1.1\r\nContent-Length: 2\r\n\r\n".to_vec()),
        Ok(b"ok".to_vec()),
    ];
    assert_eq!(
        read_request(&mut Packets(packets.into())).await.err(),
        Some(400)
    );
}
