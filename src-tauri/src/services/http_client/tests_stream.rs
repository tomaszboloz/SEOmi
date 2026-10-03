use super::resolver::public_client_builder;
use super::stream::read_bounded_text;
use super::tests_common::{fixture, fixture_bytes};

#[tokio::test]
async fn discovery_text_rejects_decoded_overflow_and_keeps_exact_limit() {
    for (response, limit, expected) in [
        ("HTTP/1.1 200 OK\r\nContent-Length: 5\r\nConnection: close\r\n\r\nhello", 5, Some("hello")),
        ("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n4\r\n1234\r\n4\r\n5678\r\n0\r\n\r\n", 5, None),
        ("HTTP/1.1 200 OK\r\nContent-Length: 1\r\nConnection: close\r\n\r\nx", 0, None),
    ] {
        let address = fixture(vec![response.into()]).await;
        let response = reqwest::Client::builder().no_proxy().build().unwrap()
            .get(format!("http://{address}/")).send().await.unwrap();
        let result = read_bounded_text(response, limit).await;
        if let Some(expected) = expected { assert_eq!(result.unwrap(), expected); }
        else { assert!(result.unwrap_err().to_string().contains("safety limit")); }
    }
}

#[tokio::test]
async fn public_client_uses_validated_local_dns_without_contacting_local_services() {
    let error = public_client_builder()
        .build()
        .unwrap()
        .get("http://localhost/")
        .send()
        .await
        .unwrap_err();
    assert!(format!("{error:?}").contains("private or reserved"));
}

#[tokio::test]
async fn discovery_text_rejects_compressed_overflow_and_incomplete_bodies() {
    use std::io::Write;
    let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
    encoder.write_all(&[b'x'; 128]).unwrap();
    let compressed = encoder.finish().unwrap();
    let mut encoded_response = format!(
        "HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        compressed.len()
    ).into_bytes();
    encoded_response.extend(compressed);
    let address = fixture_bytes(vec![encoded_response]).await;
    let response = reqwest::Client::builder()
        .no_proxy()
        .gzip(true)
        .build()
        .unwrap()
        .get(format!("http://{address}/"))
        .send()
        .await
        .unwrap();
    assert!(read_bounded_text(response, 64)
        .await
        .unwrap_err()
        .to_string()
        .contains("safety limit"));

    let address = fixture(vec![
        "HTTP/1.1 200 OK\r\nContent-Length: 10\r\nConnection: close\r\n\r\nshort".into(),
    ])
    .await;
    let response = reqwest::Client::builder()
        .no_proxy()
        .build()
        .unwrap()
        .get(format!("http://{address}/"))
        .send()
        .await
        .unwrap();
    assert!(read_bounded_text(response, 64).await.is_err());
}

#[tokio::test]
async fn streaming_limit_applies_without_content_length() {
    use super::fetch::fetch_with_resolver;
    use super::tests_common::options;
    use url::Url;

    let address = fixture(vec!["HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n4\r\n1234\r\n4\r\n5678\r\n0\r\n\r\n".into()]).await;
    let url = Url::parse(&format!("http://audit.example:{}/", address.port())).unwrap();
    let error =
        fetch_with_resolver(&url, "Test", options(5, 0), |_| async { Ok(vec![address]) })
            .await
            .unwrap_err();
    assert!(error.to_string().contains("safety limit"));
}

#[tokio::test]
async fn compressed_body_limit_counts_decoded_bytes() {
    use super::fetch::fetch_with_resolver;
    use super::tests_common::options;
    use std::io::Write;
    use url::Url;

    let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
    encoder.write_all(&[b'x'; 128]).unwrap();
    let compressed = encoder.finish().unwrap();
    let mut response = format!(
        "HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        compressed.len()
    ).into_bytes();
    response.extend(compressed);
    let address = fixture_bytes(vec![response]).await;
    let url = Url::parse(&format!("http://audit.example:{}/", address.port())).unwrap();
    let error = fetch_with_resolver(&url, "Test", options(64, 0), |_| async {
        Ok(vec![address])
    })
    .await
    .unwrap_err();
    assert!(error.to_string().contains("safety limit"));
}

#[tokio::test]
async fn deadline_applies_to_slow_body() {
    use super::fetch::fetch_with_resolver;
    use super::tests_common::options;
    use std::time::Duration;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use url::Url;

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut buffer = [0; 4096];
        let _ = stream.read(&mut buffer).await;
        stream
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nh")
            .await
            .unwrap();
        tokio::time::sleep(Duration::from_secs(1)).await;
    });
    let url = Url::parse(&format!("http://audit.example:{}/", address.port())).unwrap();
    let error =
        fetch_with_resolver(&url, "Test", options(5, 0), |_| async { Ok(vec![address]) })
            .await
            .unwrap_err();
    assert!(error.to_string().contains("timed out"), "{error}");
}
