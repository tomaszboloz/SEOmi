use super::browser::BrowserLauncher;
use super::session::{ConnectDependencies, CredentialReadError, CredentialStore, ReceiveCode};
use std::{collections::BTreeMap, future::Future, pin::Pin, sync::Mutex};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
};

pub(super) async fn responses(bodies: &[&str]) -> (String, tokio::task::JoinHandle<Vec<String>>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let bodies = bodies
        .iter()
        .map(|body| body.to_string())
        .collect::<Vec<_>>();
    let task = tokio::spawn(async move {
        let mut requests = Vec::new();
        for body in bodies {
            let (mut stream, _) = listener.accept().await.unwrap();
            let request = read_request(&mut stream).await;
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(response.as_bytes()).await.unwrap();
            requests.push(request);
        }
        requests
    });
    (endpoint, task)
}

async fn read_request(stream: &mut TcpStream) -> String {
    let mut bytes = Vec::new();
    loop {
        let mut byte = [0u8];
        stream.read_exact(&mut byte).await.unwrap();
        bytes.push(byte[0]);
        if bytes.ends_with(b"\r\n\r\n") {
            break;
        }
    }
    let headers = String::from_utf8_lossy(&bytes).to_ascii_lowercase();
    let length = headers
        .lines()
        .find_map(|line| line.strip_prefix("content-length: "))
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or_default();
    let mut body = vec![0; length];
    stream.read_exact(&mut body).await.unwrap();
    bytes.extend(body);
    String::from_utf8(bytes).unwrap()
}

pub(super) struct Store {
    values: Mutex<BTreeMap<String, String>>,
    fail_write: bool,
}

impl Store {
    pub(super) fn new(values: &[(&str, &str)], fail_write: bool) -> Self {
        Self {
            values: Mutex::new(
                values
                    .iter()
                    .map(|(k, v)| ((*k).into(), (*v).into()))
                    .collect(),
            ),
            fail_write,
        }
    }

    pub(super) fn value(&self, key: &str) -> Option<String> {
        self.values.lock().unwrap().get(key).cloned()
    }
}

impl CredentialStore for Store {
    fn read(&self, name: &str) -> Result<Option<String>, CredentialReadError> {
        Ok(self.value(name))
    }

    fn write(&self, name: &str, value: &str) -> Result<(), String> {
        if self.fail_write {
            return Err("synthetic write failure".into());
        }
        self.values
            .lock()
            .unwrap()
            .insert(name.into(), value.into());
        Ok(())
    }
}

pub(super) fn browser_ok(_: &str) -> Result<(), String> {
    Ok(())
}

pub(super) fn browser_error(_: &str) -> Result<(), String> {
    Err("synthetic browser failure".into())
}

pub(super) fn callback_ok(
    listener: TcpListener,
    _: &str,
) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + '_>> {
    drop(listener);
    Box::pin(async { Ok("fixture-code".into()) })
}

pub(super) fn callback_error(
    listener: TcpListener,
    _: &str,
) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + '_>> {
    drop(listener);
    Box::pin(async { Err("synthetic callback failure".into()) })
}

pub(super) fn dependencies<'a>(
    store: &'a Store,
    endpoint: &'a str,
    browser: BrowserLauncher,
) -> ConnectDependencies<'a> {
    dependencies_with_callback(store, endpoint, browser, callback_ok)
}

pub(super) fn dependencies_with_callback<'a>(
    store: &'a Store,
    endpoint: &'a str,
    browser: BrowserLauncher,
    receive_code: ReceiveCode,
) -> ConnectDependencies<'a> {
    ConnectDependencies {
        credentials: store,
        open_browser: browser,
        receive_code,
        token_endpoint: endpoint,
        sites_endpoint: endpoint,
    }
}

pub(super) fn client() -> reqwest::Client {
    reqwest::Client::builder().no_proxy().build().unwrap()
}
