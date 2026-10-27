use super::{error_kind, normalize_external_url};
use std::sync::Arc;
use url::Url;

struct CauseResolver(&'static str);
impl reqwest::dns::Resolve for CauseResolver {
    fn resolve(&self, _: reqwest::dns::Name) -> reqwest::dns::Resolving {
        let msg = self.0;
        Box::pin(async move { Err(std::io::Error::other(msg).into()) })
    }
}

async fn error_for_cause(cause: &'static str) -> reqwest::Error {
    reqwest::Client::builder()
        .no_proxy()
        .dns_resolver(Arc::new(CauseResolver(cause)))
        .build()
        .unwrap()
        .head("http://seomi.test/test")
        .send()
        .await
        .unwrap_err()
}

#[tokio::test]
async fn error_kind_classifies_connection_sources_and_timeouts() {
    for marker in [
        "failed to dns resolve",
        "cannot resolve host",
        "name lookup failed",
    ] {
        let error = error_for_cause(marker).await;
        assert!(error.is_connect());
        assert_eq!(error_kind(&error), "dns");
    }

    let cl = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = cl.local_addr().unwrap().port();
    drop(cl);
    let closed_err = reqwest::Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(10))
        .connect_timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap()
        .get(format!("http://127.0.0.1:{port}/"))
        .send()
        .await
        .unwrap_err();
    assert!(closed_err.is_connect());
    assert_eq!(error_kind(&closed_err), "connect");

    let timeout_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(1))
        .build()
        .unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        let (_s, _) = listener.accept().await.unwrap();
        std::future::pending::<()>().await;
    });
    let err = timeout_client
        .get(format!("http://{addr}"))
        .send()
        .await
        .unwrap_err();
    task.abort();
    assert!(err.is_timeout());
    assert_eq!(error_kind(&err), "timeout");

    let tl = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let tport = tl.local_addr().unwrap().port();
    let srv = tokio::spawn(async move {
        if let Ok((mut s, _)) = tl.accept().await {
            use tokio::io::{AsyncReadExt, AsyncWriteExt};
            let mut client_hello = [0; 4096];
            let _ = s.read(&mut client_hello).await;
            // TLS fatal handshake_failure alert, rather than an HTTP response.
            s.write_all(&[21, 3, 3, 0, 2, 2, 40]).await.unwrap();
            s.shutdown().await.unwrap();
        }
    });
    let tls_err = reqwest::Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap()
        .get(format!("https://127.0.0.1:{tport}/"))
        .send()
        .await
        .unwrap_err();
    srv.abort();
    assert!(tls_err.is_connect());
    assert_eq!(error_kind(&tls_err), "tls", "{tls_err:?}");

    let invalid_scheme_err = timeout_client
        .get("file:///invalid")
        .send()
        .await
        .unwrap_err();
    assert_eq!(error_kind(&invalid_scheme_err), "network");
}

#[path = "network_normalization_boundaries.rs"]
mod normalization_boundaries;

#[path = "network_schannel_tests.rs"]
mod schannel;
