use super::resolver::*;
use reqwest::dns::Resolve;
use url::Url;

#[tokio::test(start_paused = true)]
async fn validated_resolver_reports_a_stalled_lookup_as_a_timeout() {
    let resolver = ValidatedResolver {
        lookup: |_host| std::future::pending::<std::io::Result<Vec<std::net::SocketAddr>>>(),
    };
    let pending = resolver.resolve("crawl.example".parse().unwrap());
    let error = pending.await.err().expect("a stalled lookup must time out");
    assert!(error.to_string().contains("DNS lookup timed out"));
}

#[tokio::test(start_paused = true)]
async fn public_address_resolution_reports_stalled_and_failed_lookups() {
    let url = Url::parse("http://crawl.example/").unwrap();
    let stalled = resolve_public_addresses_with(&url, |_, _| {
        std::future::pending::<std::io::Result<Vec<std::net::SocketAddr>>>()
    });
    assert_eq!(
        stalled.await.unwrap_err().to_string(),
        "DNS lookup timed out"
    );
    let failed =
        resolve_public_addresses_with(&url, |_, _| async { Err(std::io::Error::other("refused")) })
            .await;
    assert_eq!(
        failed.unwrap_err().to_string(),
        "DNS lookup failed: refused"
    );
}
