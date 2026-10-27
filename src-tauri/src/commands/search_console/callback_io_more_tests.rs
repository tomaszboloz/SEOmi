use super::{write_callback_response, MAX_CALLBACK_HEADER_BYTES};
use tokio::{
    io::AsyncWriteExt,
    net::{TcpListener, TcpStream},
};

async fn pair() -> (TcpStream, TcpStream) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let client = TcpStream::connect(listener.local_addr().unwrap())
        .await
        .unwrap();
    let (server, _) = listener.accept().await.unwrap();
    (client, server)
}

#[tokio::test]
async fn write_callback_response_failure() {
    let (_client, mut server) = pair().await;
    server.shutdown().await.unwrap();
    let err = write_callback_response(&mut server, "200 OK", "test")
        .await
        .unwrap_err();
    assert!(err.starts_with("Unable to complete the OAuth callback:"));
}

#[test]
fn complete_request_waits_limits_and_decodes_header_blocks() {
    use super::complete_request;
    assert_eq!(complete_request(b"GET / HTTP/1.1\r\n"), None);
    assert_eq!(
        complete_request(b"GET / HTTP/1.1\r\n\r\nbody")
            .unwrap()
            .unwrap(),
        "GET / HTTP/1.1\r\n\r\n"
    );
    assert_eq!(
        complete_request(b"\xff\r\n\r\n").unwrap().unwrap_err(),
        "Invalid OAuth callback encoding."
    );
    let mut late_terminator = vec![b'x'; MAX_CALLBACK_HEADER_BYTES - 3];
    late_terminator.extend_from_slice(b"\r\n\r\n");
    assert_eq!(
        complete_request(&late_terminator).unwrap().unwrap_err(),
        "OAuth callback headers exceed the limit."
    );
    assert_eq!(
        complete_request(&vec![b'x'; MAX_CALLBACK_HEADER_BYTES])
            .unwrap()
            .unwrap_err(),
        "OAuth callback headers exceed the limit."
    );
}
