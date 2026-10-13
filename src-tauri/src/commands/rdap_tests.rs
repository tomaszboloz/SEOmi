use super::{
    rdap_client, rdap_domain_lookup, rdap_lookup_at, registrable_hostname, MAX_RDAP_BYTES,
};
use serde_json::json;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

async fn serve(response: Vec<u8>) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut buffer = [0u8; 2048];
        let _ = socket.read(&mut buffer).await;
        let _ = socket.write_all(&response).await;
    });
    base
}

fn http(status: &str, extra: &str, body: &[u8]) -> Vec<u8> {
    let mut out = format!(
        "HTTP/1.1 {status}\r\nContent-Length: {}\r\n{extra}Connection: close\r\n\r\n",
        body.len()
    )
    .into_bytes();
    out.extend_from_slice(body);
    out
}

#[test]
fn hostnames_are_normalized_and_validated() {
    assert_eq!(
        registrable_hostname(" Example.COM. ").unwrap(),
        "example.com"
    );
    for bad in [
        "",
        "localhost",
        "a..b",
        "-a.com",
        "a-.com",
        "1.2.3.4",
        "a b.com",
        "a/b.com",
        "ex_ample.com",
        &format!("{}.com", "a".repeat(64)),
    ] {
        assert_eq!(
            registrable_hostname(bad).unwrap_err(),
            "Invalid domain name.",
            "{bad}"
        );
    }
    assert!(registrable_hostname(&format!("{}.com", vec!["a".repeat(63); 4].join("."))).is_err());
}

#[tokio::test]
async fn lookup_returns_json_and_maps_failures() {
    let client = rdap_client().unwrap();
    let body = serde_json::to_vec(&json!({ "events": [] })).unwrap();
    let base = serve(http("200 OK", "", &body)).await;
    assert_eq!(
        rdap_lookup_at(&client, &base, "example.com").await.unwrap(),
        json!({ "events": [] })
    );

    let base = serve(http("404 Not Found", "", b"{}")).await;
    assert_eq!(
        rdap_lookup_at(&client, &base, "example.com")
            .await
            .unwrap_err(),
        "HTTP 404"
    );

    let base = serve(http("200 OK", "", b"not json")).await;
    assert_eq!(
        rdap_lookup_at(&client, &base, "example.com")
            .await
            .unwrap_err(),
        "RDAP response is not valid JSON."
    );

    let oversized = vec![b' '; MAX_RDAP_BYTES + 1];
    let base = serve(http("200 OK", "", &oversized)).await;
    assert_eq!(
        rdap_lookup_at(&client, &base, "example.com")
            .await
            .unwrap_err(),
        "RDAP response exceeds byte limit."
    );

    assert_eq!(
        rdap_lookup_at(&client, "http://127.0.0.1:1", "example.com")
            .await
            .unwrap_err(),
        "RDAP request failed."
    );
    assert_eq!(
        rdap_lookup_at(&client, "http://127.0.0.1:1", "bad")
            .await
            .unwrap_err(),
        "Invalid domain name."
    );
    assert_eq!(
        rdap_domain_lookup("bad".into()).await.unwrap_err(),
        "Invalid domain name."
    );
}

#[tokio::test]
async fn redirects_to_plain_http_are_not_followed() {
    let client = rdap_client().unwrap();
    let base = serve(http("302 Found", "Location: http://127.0.0.1:1/x\r\n", b"")).await;
    assert_eq!(
        rdap_lookup_at(&client, &base, "example.com")
            .await
            .unwrap_err(),
        "HTTP 302"
    );
}
