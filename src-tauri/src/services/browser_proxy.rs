use std::io;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::{watch, Semaphore};
use tokio::task::JoinHandle;
use url::Url;

mod parse;
mod server;
mod target;
mod types;
mod upstream;

#[cfg(test)]
mod tests;

#[cfg(test)]
mod parse_tests;

#[cfg(test)]
mod runtime_tests;

#[cfg(test)]
mod server_tests;

#[cfg(test)]
mod server_edge_tests;

#[cfg(test)]
mod server_fixture;

#[cfg(test)]
mod upstream_tests;

#[cfg(test)]
mod target_boundary_tests;

#[cfg(test)]
mod server_forwarding_tests;

use server::serve_connection;
use types::MAX_CONCURRENT_CONNECTIONS;
use upstream::reject;

pub struct BrowserRequestProxy {
    address: SocketAddr,
    shutdown: Option<watch::Sender<bool>>,
    task: Option<JoinHandle<()>>,
}

impl BrowserRequestProxy {
    pub async fn start() -> io::Result<Self> {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await?;
        let address = listener.local_addr()?;
        let (shutdown, mut shutdown_rx) = watch::channel(false);
        let task = tokio::spawn(async move {
            let permits = Arc::new(Semaphore::new(MAX_CONCURRENT_CONNECTIONS));
            loop {
                tokio::select! {
                    changed = shutdown_rx.changed() => {
                        if changed.is_err() || *shutdown_rx.borrow() { break; }
                    }
                    accepted = listener.accept() => {
                        let Ok((stream, _)) = accepted else { break; };
                        let Ok(permit) = permits.clone().try_acquire_owned() else {
                            reject(stream, 503, "Proxy connection limit reached").await;
                            continue;
                        };
                        let mut connection_shutdown = shutdown_rx.clone();
                        tokio::spawn(async move {
                            tokio::select! {
                                _ = serve_connection(stream) => {},
                                _ = connection_shutdown.changed() => {},
                            }
                            drop(permit);
                        });
                    }
                }
            }
        });
        Ok(Self {
            address,
            shutdown: Some(shutdown),
            task: Some(task),
        })
    }

    pub fn url(&self) -> Url {
        Url::parse(&format!(
            "http://{}:{}",
            self.address.ip(),
            self.address.port()
        ))
        .expect("loopback proxy address is a valid URL")
    }

    pub async fn stop(mut self) {
        if let Some(shutdown) = self.shutdown.take() {
            let _ = shutdown.send(true);
        }
        if let Some(task) = self.task.take() {
            let _ = task.await;
        }
    }
}

impl Drop for BrowserRequestProxy {
    fn drop(&mut self) {
        if let Some(shutdown) = self.shutdown.take() {
            let _ = shutdown.send(true);
        }
        if let Some(task) = self.task.take() {
            task.abort();
        }
    }
}
