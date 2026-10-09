use super::session::{receive_code, CredentialReadError, CredentialStore, NativeCredentialStore};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    time::{timeout, Duration},
};

#[test]
fn native_store_rejects_unsupported_names_before_keyring_io() {
    let store = NativeCredentialStore;
    assert!(matches!(
        store.read("unsupported-search-console-key"),
        Err(CredentialReadError::Store(_))
    ));
    assert!(store
        .write("unsupported-search-console-key", "synthetic-token")
        .is_err());
}

#[tokio::test]
async fn receive_code_wrapper_returns_verified_callback_code() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let callback = tokio::spawn(async move { receive_code(listener, "state-fixture").await });
    let mut stream = TcpStream::connect(address).await.unwrap();
    stream
        .write_all(
            b"GET /oauth2callback?state=state-fixture&code=fixture-code HTTP/1.1\r\nHost: localhost\r\n\r\n",
        )
        .await
        .unwrap();
    let mut response = Vec::new();
    timeout(Duration::from_secs(1), stream.read_to_end(&mut response))
        .await
        .unwrap()
        .unwrap();
    assert!(String::from_utf8_lossy(&response).starts_with("HTTP/1.1 200 OK"));
    assert_eq!(callback.await.unwrap().unwrap(), "fixture-code");
}

#[tokio::test]
async fn disconnect_search_console_rejects_invalid_project_id() {
    let err = super::disconnect_search_console("invalid/project".into())
        .await
        .unwrap_err();
    assert!(err.contains("Invalid Google Search Console project identifier"));
}

#[tokio::test]
async fn revoke_refresh_token_at_covers_success_error_and_failure_responses() {
    let client = reqwest::Client::new();

    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut buf = [0u8; 1024];
        let _ = stream.read(&mut buf).await.unwrap();
        stream
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n")
            .await
            .unwrap();
    });
    let endpoint = format!("http://{addr}/revoke");
    let res = super::disconnect::revoke_refresh_token_at(&client, &endpoint, "tok")
        .await
        .unwrap();
    assert!(res.contains("Google authorization revoked"));

    let listener2 = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let addr2 = listener2.local_addr().unwrap();
    tokio::spawn(async move {
        let (mut stream, _) = listener2.accept().await.unwrap();
        let mut buf = [0u8; 1024];
        let _ = stream.read(&mut buf).await.unwrap();
        stream
            .write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n")
            .await
            .unwrap();
    });
    let endpoint2 = format!("http://{addr2}/revoke");
    let res2 = super::disconnect::revoke_refresh_token_at(&client, &endpoint2, "tok")
        .await
        .unwrap();
    assert!(res2.contains("HTTP 400"));

    let res3 =
        super::disconnect::revoke_refresh_token_at(&client, "http://127.0.0.1:1/revoke", "tok")
            .await
            .unwrap();
    assert!(res3.contains("could not be confirmed"));
}

#[tokio::test]
async fn disconnect_search_console_removes_local_when_no_token() {
    let res = super::disconnect::disconnect_search_console("unconnected-proj-test".into())
        .await
        .unwrap();
    assert!(res.contains("already been removed"));
}

#[tokio::test]
async fn disconnect_search_console_attempts_revocation_when_token_stored() {
    let project = "revocation-project";
    let key = super::credentials::refresh_token_key(project).unwrap();
    crate::commands::settings::secret_entry(&key)
        .unwrap()
        .set_password("dummy-token")
        .unwrap();
    let (endpoint, server) = super::transport_fixture::single_response("200 OK", "").await;
    let res = super::disconnect::disconnect_search_console_at(project, &endpoint)
        .await
        .unwrap();
    let (_, body) = timeout(Duration::from_secs(2), server)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(body, b"token=dummy-token");
    assert!(res.contains("removed from the app"));
    assert!(matches!(
        crate::commands::settings::secret_entry(&key)
            .unwrap()
            .get_password(),
        Err(keyring::Error::NoEntry)
    ));
}
