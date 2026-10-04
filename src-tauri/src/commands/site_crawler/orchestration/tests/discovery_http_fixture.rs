use super::*;
use std::sync::{Arc, Mutex};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    task::JoinHandle,
};

pub struct DiscoveryServer {
    pub setup: CrawlSetup,
    pub requests: Arc<Mutex<Vec<String>>>,
    task: JoinHandle<()>,
}

impl DiscoveryServer {
    pub async fn new(config: CrawlConfig, routes: Vec<(String, u16, String)>) -> Self {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let address = listener.local_addr().unwrap();
        let mut setup = setup(config);
        setup.parsed_base =
            url::Url::parse(&format!("http://example.test:{}/", address.port())).unwrap();
        setup.normalized_start_url = setup.parsed_base.clone();
        setup.client = reqwest::Client::builder()
            .no_proxy()
            .resolve("example.test", address)
            .timeout(std::time::Duration::from_secs(2))
            .build()
            .unwrap();
        let requests = Arc::new(Mutex::new(Vec::new()));
        let observed = requests.clone();
        let base = setup.parsed_base.to_string();
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
                let route = routes.iter().find(|(candidate, _, _)| candidate == &path);
                let (status, body) = route
                    .map(|(_, code, body)| (*code, body.replace("{BASE}", &base)))
                    .unwrap_or((404, String::new()));
                let headers = format!(
                    "HTTP/1.1 {status} Fixture\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                if socket.write_all(headers.as_bytes()).await.is_ok() {
                    let _ = socket.write_all(body.as_bytes()).await;
                }
            }
        });
        Self {
            setup,
            requests,
            task,
        }
    }

    pub fn url(&self, path: &str) -> String {
        self.setup.parsed_base.join(path).unwrap().to_string()
    }
}

impl Drop for DiscoveryServer {
    fn drop(&mut self) {
        self.task.abort();
    }
}

pub fn route(path: &str, status: u16, body: &str) -> (String, u16, String) {
    (path.into(), status, body.into())
}

pub fn refused_setup() -> (CrawlSetup, tokio::net::TcpSocket) {
    let socket = tokio::net::TcpSocket::new_v4().unwrap();
    socket.bind("127.0.0.1:0".parse().unwrap()).unwrap();
    let address = socket.local_addr().unwrap();
    let mut setup = setup(default_crawl_config(None));
    setup.parsed_base =
        url::Url::parse(&format!("http://example.test:{}/", address.port())).unwrap();
    setup.client = reqwest::Client::builder()
        .no_proxy()
        .resolve("example.test", address)
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .unwrap();
    (setup, socket)
}
