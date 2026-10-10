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
#[derive(Clone)]
pub struct Route {
    path: String,
    status: u16,
    body: String,
    headers: Vec<String>,
    delay_ms: u64,
}
impl DiscoveryServer {
    pub async fn new(config: CrawlConfig, routes: Vec<Route>) -> Self {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let address = listener.local_addr().unwrap();
        let mut setup = setup(config);
        setup.parsed_base =
            url::Url::parse(&format!("http://example.test:{}/", address.port())).unwrap();
        setup.normalized_start_url = setup.parsed_base.clone();
        setup.client = reqwest::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .resolve("example.test", address)
            .resolve("www.example.test", address)
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
                let route = routes.iter().find(|route| route.path == path);
                let (status, body, extra_headers, delay_ms) = route
                    .map(|route| {
                        (
                            route.status,
                            route.body.replace("{BASE}", &base),
                            route
                                .headers
                                .join("\r\n")
                                .replace("{PORT}", &address.port().to_string()),
                            route.delay_ms,
                        )
                    })
                    .unwrap_or((404, String::new(), String::new(), 0));
                let headers = format!(
                    "HTTP/1.1 {status} Fixture\r\nContent-Length: {}\r\n{}{}Connection: close\r\n\r\n",
                    body.len(),
                    extra_headers,
                    if extra_headers.is_empty() { "" } else { "\r\n" }
                );
                if delay_ms > 0 {
                    tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                }
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

pub fn route(path: &str, status: u16, body: &str) -> Route {
    Route {
        path: path.into(),
        status,
        body: body.into(),
        headers: Vec::new(),
        delay_ms: 0,
    }
}

pub fn delayed_route(path: &str, status: u16, body: &str, delay_ms: u64) -> Route {
    let mut route = route(path, status, body);
    route.delay_ms = delay_ms;
    route
}

pub fn redirect(path: &str, location: &str) -> Route {
    let mut route = route(path, 302, "");
    route.headers.push(format!("Location: {location}"));
    route
}

pub fn html_route(path: &str, body: &str) -> Route {
    let mut route = route(path, 200, body);
    route.headers.push("Content-Type: text/html".into());
    route
}

pub fn media_route(path: &str, body: &str) -> Route {
    let mut route = route(path, 200, body);
    route.headers.push("Content-Type: image/png".into());
    route
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
