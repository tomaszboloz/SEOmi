use super::{models::*, server::handle_connection};
use std::{future::Future, io, net::SocketAddr};
use tauri::Runtime;
use tokio::{
    net::{TcpListener, TcpStream},
    sync::oneshot,
    time::{sleep_until, timeout},
};

pub(super) enum Admission {
    Serve(TcpStream),
    Skip,
    Stop,
}

/// Only loopback peers may talk to the worker; an accept failure stops the listener.
pub(super) fn admit_connection(accepted: io::Result<(TcpStream, SocketAddr)>) -> Admission {
    match accepted {
        Ok((stream, peer)) if peer.ip().is_loopback() => Admission::Serve(stream),
        Ok(_) => Admission::Skip,
        Err(_) => Admission::Stop,
    }
}

pub(super) async fn run_worker<R: Runtime>(
    listener: TcpListener,
    shared: WorkerShared<R>,
    shutdown: oneshot::Receiver<()>,
) {
    run_accept_loop(|| listener.accept(), shared, shutdown).await
}

/// Serves connections from `accept` until shutdown, lease expiry or an accept failure.
pub(super) async fn run_accept_loop<R, A, F>(
    mut accept: A,
    shared: WorkerShared<R>,
    mut shutdown: oneshot::Receiver<()>,
) where
    R: Runtime,
    A: FnMut() -> F,
    F: Future<Output = io::Result<(TcpStream, SocketAddr)>>,
{
    loop {
        tokio::select! {
            _ = &mut shutdown => break,
            _ = sleep_until(shared.expires_at) => break,
            accepted = accept() => {
                let stream = match admit_connection(accepted) {
                    Admission::Serve(stream) => stream,
                    Admission::Skip => continue,
                    Admission::Stop => break,
                };
                let connection_shared = shared.clone();
                tokio::spawn(async move {
                    let _ = timeout(REQUEST_TIMEOUT, handle_connection(stream, connection_shared)).await;
                });
            }
        }
    }
}
