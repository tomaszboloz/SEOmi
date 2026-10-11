use super::error_kind;
use std::sync::Arc;

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

struct RawCodeResolver(i32);
impl reqwest::dns::Resolve for RawCodeResolver {
    fn resolve(&self, _: reqwest::dns::Name) -> reqwest::dns::Resolving {
        let code = self.0;
        Box::pin(async move { Err(std::io::Error::from_raw_os_error(code).into()) })
    }
}

async fn error_for_raw_code(code: i32) -> reqwest::Error {
    reqwest::Client::builder()
        .no_proxy()
        .dns_resolver(Arc::new(RawCodeResolver(code)))
        .build()
        .unwrap()
        .head("http://seomi.test/test")
        .send()
        .await
        .unwrap_err()
}

#[tokio::test]
async fn error_kind_classifies_dns_keywords() {
    for marker in [
        "failed dns query",
        "cannot resolve target",
        "host lookup failed",
    ] {
        let err = error_for_cause(marker).await;
        assert_eq!(error_kind(&err), "dns");
    }
}

#[tokio::test]
async fn error_kind_classifies_all_tls_markers() {
    for marker in ["tls failed", "invalid certificate", "handshake failure"] {
        let err = error_for_cause(marker).await;
        assert_eq!(error_kind(&err), "tls", "marker: {marker}");
    }
}

#[tokio::test]
async fn error_kind_classifies_schannel_raw_codes() {
    for code in [0x8009030fu32, 0x80090326, 0x80090331] {
        let err = error_for_raw_code(code as i32).await;
        assert_eq!(error_kind(&err), "tls", "code: {code:x}");
    }
}

#[tokio::test]
async fn error_kind_classifies_connect_timeout_and_network() {
    let connect_err = error_for_cause("connection refused by peer").await;
    assert_eq!(error_kind(&connect_err), "connect");

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
    let t_err = timeout_client
        .get(format!("http://{addr}"))
        .send()
        .await
        .unwrap_err();
    task.abort();
    assert_eq!(error_kind(&t_err), "timeout");

    let net_err = timeout_client
        .get("file:///tmp/err")
        .send()
        .await
        .unwrap_err();
    assert_eq!(error_kind(&net_err), "network");
}
