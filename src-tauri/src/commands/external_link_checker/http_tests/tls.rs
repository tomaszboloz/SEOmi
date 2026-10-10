use super::super::network::{client_for_url, error_kind};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use url::Url;

#[tokio::test]
async fn fatal_certificate_alert_is_reported_as_tls_not_dns() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut header = [0; 5];
        stream.read_exact(&mut header).await.unwrap();
        assert_eq!(header[0], 0x16, "client must send a TLS handshake");
        let length = u16::from_be_bytes([header[3], header[4]]) as usize;
        assert!(length <= 16_384);
        let mut hello = vec![0; length];
        stream.read_exact(&mut hello).await.unwrap();
        assert_eq!(hello[0], 1, "first handshake must be ClientHello");
        // TLS fatal alert, bad_certificate: exercise the actual TLS backend.
        stream
            .write_all(&[0x15, 0x03, 0x03, 0, 2, 2, 42])
            .await
            .unwrap();
        stream.shutdown().await.unwrap();
    });
    let url = Url::parse(&format!("https://seomi.test:{}/dns-lookup", address.port())).unwrap();
    let error = client_for_url(&url, &[address])
        .unwrap()
        .head(url)
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .unwrap_err();
    tokio::time::timeout(Duration::from_secs(10), server)
        .await
        .unwrap()
        .unwrap();
    assert!(error.is_connect());
    assert_eq!(error_kind(&error), "tls");
}

#[tokio::test]
async fn connection_refusal_does_not_use_tls_words_from_url_as_a_cause() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    drop(listener);
    let url = Url::parse(&format!(
        "http://seomi.test:{}/tls-certificate-handshake",
        address.port()
    ))
    .unwrap();
    let error = client_for_url(&url, &[address])
        .unwrap()
        .head(url)
        .send()
        .await
        .unwrap_err();
    assert!(error.is_connect());
    assert_eq!(error_kind(&error), "connect");
}
