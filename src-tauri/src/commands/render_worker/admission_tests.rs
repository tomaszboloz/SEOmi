use super::server::{admit_connection, Admission};
use std::net::SocketAddr;
use tokio::net::{TcpListener, TcpStream};

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
