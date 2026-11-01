use super::*;
use crate::services::http_client::tests_common::{fixture, fixture_bytes};

const PNG: &str = "HTTP/1.1 200 OK\r\nContent-Type: image/png; charset=x\r\nContent-Length: 3\r\nConnection: close\r\n\r\nabc";

async fn run(responses: Vec<String>, url: &str) -> Result<ImageBytes> {
    let address = fixture(responses).await;
    let target = Url::parse(&format!("{url}:{}/", address.port())).unwrap();
    fetch_image_with_resolver(&target, Duration::from_millis(500), |_| async move {
        Ok(vec![address])
    })
    .await
}

#[tokio::test]
async fn downloads_a_raster_image_and_follows_a_redirect() {
    let image = run(vec![PNG.into()], "http://img.example").await.unwrap();
    assert_eq!(image.bytes, b"abc");
    assert_eq!(image.content_type, "image/png");
    assert!(image.final_url.starts_with("http://img.example:"));
    let hop = "HTTP/1.1 302 Found\r\nLocation: /next.png\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    let moved = run(vec![hop.into(), PNG.into()], "http://img.example")
        .await
        .unwrap();
    assert!(moved.final_url.ends_with("/next.png"));
}

#[tokio::test]
async fn refuses_bad_redirects_statuses_and_content() {
    let bare = "HTTP/1.1 302 Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    let unsafe_hop = "HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1/x\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    let loop_hop =
        "HTTP/1.1 302 Found\r\nLocation: /again\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    let missing = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    let svg = "HTTP/1.1 200 OK\r\nContent-Type: image/svg+xml\r\nContent-Length: 1\r\nConnection: close\r\n\r\n<";
    let html = "HTTP/1.1 200 OK\r\nContent-Length: 1\r\nConnection: close\r\n\r\n<";
    for (responses, text) in [
        (vec![bare.to_string()], "without location"),
        (vec![unsafe_hop.to_string()], "Unsafe redirect"),
        (vec![loop_hop.to_string(); 6], "Too many redirects"),
        (vec![missing.to_string()], "HTTP 404"),
        (vec![svg.to_string()], "Not a raster image"),
        (vec![html.to_string()], "Not a raster image"),
    ] {
        let error = run(responses, "http://img.example").await.unwrap_err();
        assert!(error.to_string().contains(text), "{text}: {error}");
    }
    assert!(run(vec![], "ftp://img.example").await.is_err());
}

#[tokio::test]
async fn enforces_the_size_cap_and_the_deadline() {
    let mut big =
        b"HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nConnection: close\r\n\r\n".to_vec();
    big.extend(vec![0u8; MAX_IMAGE_BYTES + 1]);
    let address = fixture_bytes(vec![big]).await;
    let target = Url::parse(&format!("http://img.example:{}/", address.port())).unwrap();
    let error = fetch_image_with_resolver(&target, Duration::from_secs(5), |_| async move {
        Ok(vec![address])
    })
    .await
    .unwrap_err();
    assert!(error.to_string().contains("exceeds safety limit"));
    let slow = fetch_image_with_resolver(&target, Duration::from_millis(20), |_| async {
        std::future::pending::<Result<Vec<SocketAddr>>>().await
    })
    .await
    .unwrap_err();
    assert!(slow.to_string().contains("timed out"));
}
