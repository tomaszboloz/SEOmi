use super::{accepted_stream, stop_signalled};
use tokio::{net::TcpListener, sync::watch};

#[tokio::test]
async fn stop_signalled_reflects_the_flag_and_a_dropped_sender() {
    let (sender, mut receiver) = watch::channel(false);
    sender.send(false).unwrap();
    let changed = receiver.changed().await;
    assert!(!stop_signalled(changed, &receiver));

    sender.send(true).unwrap();
    let changed = receiver.changed().await;
    assert!(stop_signalled(changed, &receiver));

    let (sender, mut receiver) = watch::channel(false);
    drop(sender);
    let changed = receiver.changed().await;
    assert!(changed.is_err());
    assert!(stop_signalled(changed, &receiver));
}

#[tokio::test]
async fn accepted_stream_keeps_connections_and_drops_accept_failures() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let connect = tokio::net::TcpStream::connect(address);
    let (accepted, _client) = tokio::join!(listener.accept(), connect);
    assert!(accepted_stream(accepted).is_some());
    assert!(accepted_stream(Err(std::io::Error::other("accept failed"))).is_none());
}

#[tokio::test]
async fn running_proxy_keeps_serving_after_a_spurious_shutdown_notification() {
    let proxy = super::BrowserRequestProxy::start().await.unwrap();
    let sender = proxy.shutdown.as_ref().unwrap();
    sender.send(false).unwrap();
    tokio::task::yield_now().await;
    let address = proxy.url();
    let host = address.host_str().unwrap();
    let port = address.port().unwrap();
    assert!(tokio::net::TcpStream::connect((host, port)).await.is_ok());
    proxy.stop().await;
}
