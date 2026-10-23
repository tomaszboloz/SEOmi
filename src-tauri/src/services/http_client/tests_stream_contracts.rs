use super::{
    models::MAX_BODY_BYTES,
    stream::{read_bounded_bytes, read_bounded_text},
    tests_common::fixture_bytes,
};

async fn response(body: &[u8]) -> reqwest::Response {
    let mut wire = format!(
        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    )
    .into_bytes();
    wire.extend_from_slice(body);
    let address = fixture_bytes(vec![wire]).await;
    reqwest::Client::builder()
        .no_proxy()
        .build()
        .unwrap()
        .get(format!("http://{address}/"))
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn caller_cannot_relax_the_global_body_safety_cap() {
    let body = vec![b'x'; MAX_BODY_BYTES + 1];
    let exact = read_bounded_bytes(response(&body[..MAX_BODY_BYTES]).await, usize::MAX)
        .await
        .unwrap();
    assert_eq!(exact, body[..MAX_BODY_BYTES]);
    let error = read_bounded_bytes(response(&body).await, usize::MAX)
        .await
        .unwrap_err();
    assert_eq!(
        error.to_string(),
        format!("Response size exceeds safety limit of {MAX_BODY_BYTES} bytes")
    );
}

#[tokio::test]
async fn zero_budget_accepts_an_empty_body_and_rejects_the_first_byte() {
    assert!(read_bounded_bytes(response(b"").await, 0)
        .await
        .unwrap()
        .is_empty());
    let error = read_bounded_bytes(response(b"x").await, 0)
        .await
        .unwrap_err();
    assert_eq!(error.to_string(), "Response size exceeds safety limit of 0 bytes");
}

#[tokio::test]
async fn text_budget_counts_bytes_before_lossy_utf8_decoding() {
    let body = [b'a', 0xff, b'b'];
    assert_eq!(
        read_bounded_text(response(&body).await, body.len()).await.unwrap(),
        "a\u{fffd}b"
    );
    let error = read_bounded_text(response(&body).await, body.len() - 1)
        .await
        .unwrap_err();
    assert_eq!(error.to_string(), "Response size exceeds safety limit of 2 bytes");
}
