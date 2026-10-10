use super::{concurrency::new_host_gates, network::client_for_url, request::check_with_gates};
use std::{
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

#[tokio::test]
async fn redirected_hosts_share_the_destination_gate_without_deadlocking() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let port = address.port();
    let active = Arc::new(AtomicUsize::new(0));
    let peak = Arc::new(AtomicUsize::new(0));
    let server_active = active.clone();
    let server_peak = peak.clone();
    let server = tokio::spawn(async move {
        let mut handlers = Vec::new();
        for _ in 0..8 {
            let (mut stream, _) = listener.accept().await.unwrap();
            let active = server_active.clone();
            let peak = server_peak.clone();
            handlers.push(tokio::spawn(async move {
                let mut request = Vec::new();
                loop {
                    let mut byte = [0];
                    stream.read_exact(&mut byte).await.unwrap();
                    request.push(byte[0]);
                    if request.ends_with(b"\r\n\r\n") { break; }
                }
                let request = String::from_utf8(request).unwrap().to_ascii_lowercase();
                let response = if request.contains("host: shared.test:") {
                    let now = active.fetch_add(1, Ordering::SeqCst) + 1;
                    peak.fetch_max(now, Ordering::SeqCst);
                    tokio::time::sleep(Duration::from_millis(40)).await;
                    active.fetch_sub(1, Ordering::SeqCst);
                    b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_vec()
                } else {
                    format!("HTTP/1.1 302 Found\r\nLocation: http://shared.test:{port}/final\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").into_bytes()
                };
                stream.write_all(&response).await.unwrap();
            }));
        }
        for handler in handlers {
            handler.await.unwrap();
        }
    });
    let gates = new_host_gates();
    let mut checks = Vec::new();
    for index in 0..4 {
        let gates = gates.clone();
        checks.push(tokio::spawn(async move {
            let input = format!("http://source-{index}.test:{port}/start");
            check_with_gates(
                input,
                move |_| async move { Ok(vec![address]) },
                client_for_url,
                Some(gates),
            )
            .await
        }));
    }
    for check in checks {
        assert_eq!(check.await.unwrap().http_status, Some(200));
    }
    server.await.unwrap();
    assert!(
        peak.load(Ordering::SeqCst) <= 2,
        "destination gate exceeded: {}",
        peak.load(Ordering::SeqCst)
    );
}
