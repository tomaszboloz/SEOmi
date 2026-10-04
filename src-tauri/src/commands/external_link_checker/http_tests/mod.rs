mod dns;
mod failures;
mod responses;

use super::models::ExternalLinkCheck;
use super::network::client_for_url;
use super::request::check_with;
use std::{net::SocketAddr, time::Duration};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use url::Url;

struct Server {
    url: Url,
    address: SocketAddr,
    task: tokio::task::JoinHandle<Vec<String>>,
}

impl Server {
    async fn new(responses: Vec<Vec<u8>>) -> Self {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move {
            let mut requests = Vec::new();
            for response in responses {
                let (mut stream, _) =
                    tokio::time::timeout(Duration::from_secs(3), listener.accept())
                        .await
                        .unwrap()
                        .unwrap();
                let mut request = Vec::new();
                loop {
                    let mut byte = [0];
                    tokio::time::timeout(Duration::from_secs(3), stream.read_exact(&mut byte))
                        .await
                        .unwrap()
                        .unwrap();
                    request.push(byte[0]);
                    if request.ends_with(b"\r\n\r\n") {
                        break;
                    }
                    assert!(request.len() < 8192);
                }
                requests.push(String::from_utf8(request).unwrap());
                stream.write_all(&response).await.unwrap();
            }
            requests
        });
        Self {
            url: Url::parse(&format!("http://seomi.test:{}/page?q=1", address.port())).unwrap(),
            address,
            task,
        }
    }
    async fn check(&self) -> ExternalLinkCheck {
        let address = self.address;
        check_with(
            format!("{}#fragment", self.url),
            move |_| async move { Ok(vec![address]) },
            client_for_url,
        )
        .await
    }
    async fn requests(self) -> Vec<String> {
        self.task.await.unwrap()
    }
}

fn response(status: u16, location: Option<&[u8]>) -> Vec<u8> {
    let mut bytes = format!("HTTP/1.1 {status} Test\r\nContent-Length: 0\r\nConnection: close\r\n")
        .into_bytes();
    if let Some(location) = location {
        bytes.extend_from_slice(b"Location: ");
        bytes.extend_from_slice(location);
        bytes.extend_from_slice(b"\r\n");
    }
    bytes.extend_from_slice(b"\r\n");
    bytes
}

fn assert_rejection(result: &ExternalLinkCheck, url: &str, kind: &str) {
    assert_eq!(result.url, url);
    assert_eq!(result.request_error_kind.as_deref(), Some(kind));
    assert_eq!(result.http_status, None);
    assert_eq!(result.response_time_ms, None);
    assert_eq!(result.redirect_url, None);
    assert!(chrono::DateTime::parse_from_rfc3339(&result.checked_at).is_ok());
}
