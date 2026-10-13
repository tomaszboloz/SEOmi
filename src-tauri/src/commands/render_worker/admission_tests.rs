use super::admission::{admit_connection, run_accept_loop, Admission};
use super::models::WorkerShared;
use crate::utils::test_app::StorageApp;
use std::{net::SocketAddr, sync::Arc, time::Duration};
use tauri::test::mock_builder;
use tokio::net::{TcpListener, TcpStream};
use tokio::{sync::Mutex, time::Instant};

async fn connected_stream() -> TcpStream {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let client = TcpStream::connect(listener.local_addr().unwrap());
    let (accepted, _) = tokio::join!(listener.accept(), client);
    accepted.unwrap().0
}

#[tokio::test]
async fn only_loopback_peers_are_served_and_accept_errors_stop_the_listener() {
    let loopback: SocketAddr = "127.0.0.1:4000".parse().unwrap();
    let remote: SocketAddr = "192.0.2.10:4000".parse().unwrap();
    assert!(matches!(
        admit_connection(Ok((connected_stream().await, loopback))),
        Admission::Serve(_)
    ));
    assert!(matches!(
        admit_connection(Ok((connected_stream().await, remote))),
        Admission::Skip
    ));
    assert!(matches!(
        admit_connection(Err(std::io::Error::other("accept failed"))),
        Admission::Stop
    ));
}

#[tokio::test]
async fn accept_loop_skips_remote_peers_then_stops_on_accept_failure() {
    let app = StorageApp::new(mock_builder());
    let shared = WorkerShared {
        app: app.handle(),
        token: Arc::new(Mutex::new(None)),
        expires_at: Instant::now() + Duration::from_secs(60),
        expires_at_text: "exp".into(),
    };
    let remote: SocketAddr = "192.0.2.10:4000".parse().unwrap();
    let stream = connected_stream().await;
    let mut script = vec![Ok((stream, remote)), Err(std::io::Error::other("down"))].into_iter();
    let mut calls = 0;
    let (_keep_open, shutdown) = tokio::sync::oneshot::channel();
    let accept = || {
        calls += 1;
        std::future::ready(script.next().unwrap())
    };
    tokio::time::timeout(
        Duration::from_secs(5),
        run_accept_loop(accept, shared, shutdown),
    )
    .await
    .expect("loop must stop on the accept failure");
    assert_eq!(calls, 2);
}
