use super::*;
use std::sync::{Arc, Mutex};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

struct Server {
    client: reqwest::Client,
    base: String,
    requests: Arc<Mutex<Vec<String>>>,
    task: tokio::task::JoinHandle<()>,
}

impl Server {
    async fn new(routes: Vec<(&str, u16, &str)>) -> Self {
        let routes = routes
            .into_iter()
            .map(|(path, status, headers)| (path.to_string(), status, headers.to_string()))
            .collect::<Vec<_>>();
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let address = listener.local_addr().unwrap();
        let base = format!("http://example.test:{}", address.port());
        let client = reqwest::Client::builder()
            .no_proxy()
            .resolve("example.test", address)
            .redirect(reqwest::redirect::Policy::none())
            .timeout(std::time::Duration::from_secs(2))
            .build()
            .unwrap();
        let requests = Arc::new(Mutex::new(Vec::new()));
        let observed = requests.clone();
        let task = tokio::spawn(async move {
            while let Ok((mut socket, _)) = listener.accept().await {
                let mut request = Vec::new();
                let mut buffer = [0; 1024];
                loop {
                    let count = socket.read(&mut buffer).await.unwrap();
                    if count == 0 {
                        break;
                    }
                    request.extend_from_slice(&buffer[..count]);
                    if request.windows(4).any(|part| part == b"\r\n\r\n") {
                        break;
                    }
                }
                let text = String::from_utf8(request).unwrap();
                let path = text.split_whitespace().nth(1).unwrap().to_string();
                observed.lock().unwrap().push(path.clone());
                let (_, status, headers) =
                    routes.iter().find(|(route, _, _)| route == &path).unwrap();
                let response = format!("HTTP/1.1 {status} Fixture\r\n{headers}Content-Length: 0\r\nConnection: close\r\n\r\n");
                let _ = socket.write_all(response.as_bytes()).await;
            }
        });
        Self {
            client,
            base,
            requests,
            task,
        }
    }

    async fn fetch(&self, path: &str, scope: Option<&str>, limit: usize) -> FetchedResponse {
        request_with_safe_redirects(
            &self.client,
            &format!("{}{path}", self.base),
            "example.test",
            false,
            scope,
            &[],
            limit,
            &serde_json::from_value(serde_json::json!({})).unwrap(),
        )
        .await
        .unwrap()
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        self.task.abort();
    }
}

fn status(result: FetchedResponse) -> u16 {
    match result.response {
        FetchedPageBody::Http(response) => response.status().as_u16(),
        _ => panic!("expected HTTP body"),
    }
}

mod boundaries;
mod helpers;
mod redirects;
