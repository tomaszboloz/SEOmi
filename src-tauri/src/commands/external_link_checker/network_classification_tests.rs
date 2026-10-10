use super::{checked_public_addresses, error_kind, normalize_external_url};
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
    for marker in [
        "tls alert fatal",
        "bad certificate signature",
        "handshake failure occurred",
    ] {
        let error = error_for_cause(marker).await;
        assert!(error.is_connect());
        assert_eq!(error_kind(&error), "dns"); // These are resolver failures, not TLS handshakes.
    }
    let error = error_for_cause("raw network refusal without keywords").await;
    assert!(error.is_connect());
    assert_eq!(error_kind(&error), "dns");

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

    let invalid_scheme_err = timeout_client
        .get("file:///invalid")
        .send()
        .await
        .unwrap_err();
    assert_eq!(error_kind(&invalid_scheme_err), "network");
}

#[tokio::test]
async fn checked_public_addresses_rejects_missing_host_and_port() {
    let no_host = Url::parse("data:text/plain,hello").unwrap();
    assert_eq!(
        checked_public_addresses(&no_host).await.unwrap_err(),
        "URL has no host"
    );

    let no_port = Url::parse("gopher://example.test").unwrap();
    assert_eq!(
        checked_public_addresses(&no_port).await.unwrap_err(),
        "URL has no HTTP port"
    );
}

#[test]
fn normalize_external_url_rejects_unparseable_inputs() {
    assert!(normalize_external_url("not a valid url").is_err());
    assert!(normalize_external_url("   ").is_err());
}
