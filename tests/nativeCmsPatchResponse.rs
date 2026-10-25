use super::*;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

async fn read_request_headers<S: AsyncReadExt + Unpin>(stream: &mut S) {
    let mut buf = [0; 512];
    let mut request = Vec::new();
    while let Ok(count) = stream.read(&mut buf).await {
        if count == 0 {
            break;
        }
        request.extend_from_slice(&buf[..count]);
        if request.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
    }
}

#[tokio::test]
async fn read_cms_response_handles_success_and_invalid_utf8() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        for body in [&b"{\"ok\":true}"[..], &vec![b'a'; 32][..], &b"\xff\xfe"[..]] {
            if let Ok((mut stream, _)) = listener.accept().await {
                read_request_headers(&mut stream).await;
                let head = format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\n\r\n", body.len());
                let _ = stream.write_all(head.as_bytes()).await;
                let _ = stream.write_all(body).await;
            }
        }
    });

    let client = reqwest::Client::builder().no_proxy().build().unwrap();
    let url = format!("http://127.0.0.1:{}/", addr.port());

    let resp = client.get(&url).send().await.unwrap();
    let res = read_cms_response(resp).await.unwrap();
    assert_eq!(res.status, 200);
    assert_eq!(res.body, "{\"ok\":true}");

    let resp = client.get(&url).send().await.unwrap();
    let res = read_cms_response(resp).await.unwrap();
    assert_eq!(res.body.len(), 32);

    let resp = client.get(&url).send().await.unwrap();
    assert_eq!(
        read_cms_response(resp).await.unwrap_err(),
        "Invalid CMS response encoding"
    );
}

#[tokio::test]
async fn read_cms_response_rejects_oversized_response() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        if let Ok((mut stream, _)) = listener.accept().await {
            read_request_headers(&mut stream).await;
            let chunk_len = MAX_BYTES + 1;
            let head =
                format!("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n{chunk_len:x}\r\n");
            let _ = stream.write_all(head.as_bytes()).await;
            let _ = stream.write_all(&vec![b'b'; chunk_len]).await;
            let _ = stream.write_all(b"\r\n0\r\n\r\n").await;
        }
    });

    let client = reqwest::Client::builder().no_proxy().build().unwrap();
    let resp = client
        .get(format!("http://127.0.0.1:{}/", addr.port()))
        .send()
        .await
        .unwrap();
    assert_eq!(
        read_cms_response(resp).await.unwrap_err(),
        "CMS response is too large"
    );
}

#[tokio::test]
async fn read_cms_response_rejects_truncated_response() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        if let Ok((mut stream, _)) = listener.accept().await {
            read_request_headers(&mut stream).await;
            let _ = stream
                .write_all(
                    b"HTTP/1.1 200 OK\r\nContent-Length: 100\r\nConnection: close\r\n\r\nshort body",
                )
                .await;
            let _ = stream.shutdown().await;
        }
    });

    let client = reqwest::Client::builder().no_proxy().build().unwrap();
    let resp = client
        .get(format!("http://127.0.0.1:{}/", addr.port()))
        .send()
        .await
        .unwrap();
    assert_eq!(
        read_cms_response(resp).await.unwrap_err(),
        "Unable to read CMS response"
    );
}
