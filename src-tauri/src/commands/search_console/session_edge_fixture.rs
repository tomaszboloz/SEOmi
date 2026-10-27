use super::session::{CredentialReadError, CredentialStore};
use std::{collections::BTreeMap, sync::Mutex};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    time::{timeout, Duration},
};

#[derive(Default)]
pub struct Store {
    pub values: Mutex<BTreeMap<String, String>>,
    pub reads: Mutex<Vec<String>>,
    pub writes: Mutex<Vec<(String, String)>>,
    pub read_error: Option<(&'static str, bool)>,
    pub write_error: Option<&'static str>,
}

impl Store {
    pub fn with_values(values: &[(&str, &str)]) -> Self {
        Self {
            values: Mutex::new(
                values
                    .iter()
                    .map(|(k, v)| ((*k).into(), (*v).into()))
                    .collect(),
            ),
            ..Self::default()
        }
    }
}

impl CredentialStore for Store {
    fn read(&self, name: &str) -> Result<Option<String>, CredentialReadError> {
        self.reads.lock().unwrap().push(name.into());
        if let Some((key, store_error)) = self.read_error {
            if name == key {
                return Err(if store_error {
                    CredentialReadError::Store("fixture store unavailable".into())
                } else {
                    CredentialReadError::Value
                });
            }
        }
        Ok(self.values.lock().unwrap().get(name).cloned())
    }

    fn write(&self, name: &str, value: &str) -> Result<(), String> {
        self.writes
            .lock()
            .unwrap()
            .push((name.into(), value.into()));
        if self.write_error == Some(name) {
            return Err("fixture write rejected".into());
        }
        self.values
            .lock()
            .unwrap()
            .insert(name.into(), value.into());
        Ok(())
    }
}

pub struct Server {
    pub endpoint: String,
    task: Option<tokio::task::JoinHandle<Vec<String>>>,
}

impl Server {
    pub async fn new(replies: &[(&str, &str)]) -> Self {
        let wires = replies.iter().map(|(status, body)| format!("HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len())).collect();
        Self::wire(wires).await
    }

    pub async fn wire(wires: Vec<String>) -> Self {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let endpoint = format!("http://{}", listener.local_addr().unwrap());
        let task = tokio::spawn(async move {
            let mut requests = Vec::new();
            for wire in wires {
                let (mut stream, _) = timeout(Duration::from_secs(5), listener.accept())
                    .await
                    .unwrap()
                    .unwrap();
                requests.push(
                    timeout(Duration::from_secs(5), read_request(&mut stream))
                        .await
                        .unwrap(),
                );
                stream.write_all(wire.as_bytes()).await.unwrap();
                stream.shutdown().await.unwrap();
            }
            requests
        });
        Self {
            endpoint,
            task: Some(task),
        }
    }

    pub async fn finish(mut self) -> Vec<String> {
        timeout(Duration::from_secs(5), self.task.as_mut().unwrap())
            .await
            .unwrap()
            .unwrap()
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        if let Some(task) = &self.task {
            task.abort();
        }
    }
}

async fn read_request(stream: &mut TcpStream) -> String {
    let mut bytes = Vec::new();
    loop {
        let mut byte = [0];
        stream.read_exact(&mut byte).await.unwrap();
        bytes.push(byte[0]);
        if bytes.ends_with(b"\r\n\r\n") {
            break;
        }
        assert!(bytes.len() < 16 * 1024);
    }
    let length = String::from_utf8_lossy(&bytes)
        .to_ascii_lowercase()
        .lines()
        .find_map(|line| {
            line.strip_prefix("content-length: ")
                .and_then(|n| n.parse::<usize>().ok())
        })
        .unwrap_or_default();
    let mut body = vec![0; length];
    stream.read_exact(&mut body).await.unwrap();
    bytes.extend(body);
    String::from_utf8(bytes).unwrap()
}

pub use super::session_request_helpers::dependencies;
pub(super) use super::session_request_helpers::{form, refused_endpoint};
