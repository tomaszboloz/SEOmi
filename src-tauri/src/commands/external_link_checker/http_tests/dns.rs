use super::super::network::error_kind;
use std::sync::Arc;

struct FailingDns;
impl reqwest::dns::Resolve for FailingDns {
    fn resolve(&self, _: reqwest::dns::Name) -> reqwest::dns::Resolving {
        Box::pin(async { Err(std::io::Error::other("fixture lookup failure").into()) })
    }
}

#[tokio::test]
async fn dns_classification_uses_underlying_cause_instead_of_request_url() {
    let client = reqwest::Client::builder()
        .no_proxy()
        .dns_resolver(Arc::new(FailingDns))
        .build()
        .unwrap();
    let error = client
        .head("http://seomi.test/page")
        .send()
        .await
        .unwrap_err();
    assert!(error.is_connect());
    assert_eq!(error_kind(&error), "dns");
}

#[tokio::test]
async fn connection_classification_ignores_dns_words_in_the_request_url() {
    use super::super::network::client_for_url;
    use tokio::io::AsyncReadExt;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut byte = [0];
        stream.read_exact(&mut byte).await.unwrap();
        assert_eq!(byte[0], 0x16);
    });
    let url =
        url::Url::parse(&format!("https://seomi.test:{}/dns-lookup", address.port())).unwrap();
    let error = client_for_url(&url, &[address])
        .unwrap()
        .head(url)
        .send()
        .await
        .unwrap_err();
    task.await.unwrap();
    assert!(error.is_connect());
    assert!(matches!(error_kind(&error).as_str(), "connect" | "tls"));
    assert_ne!(error_kind(&error), "dns");
}
