use super::{
    fetch::fetch_with_resolver,
    resolver::resolve_public_addresses,
    tests_common::{fixture, options},
};
use url::Url;

#[tokio::test]
async fn invalid_user_agent_is_ignored_without_losing_the_response() {
    let address = fixture(vec![
        "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok".into(),
    ])
    .await;
    let target = Url::parse(&format!("http://audit.example:{}/", address.port())).unwrap();
    let result = fetch_with_resolver(&target, "invalid\0-agent", options(16, 0), |_| async {
        Ok(vec![address])
    })
    .await
    .unwrap();
    assert_eq!(result.status, 200);
    assert_eq!(result.body, "ok");
}

#[tokio::test]
async fn redirect_without_location_is_returned_as_the_observed_response() {
    let address = fixture(vec![
        "HTTP/1.1 302 Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".into(),
    ])
    .await;
    let target = Url::parse(&format!("http://audit.example:{}/start", address.port())).unwrap();
    let result = fetch_with_resolver(&target, "fixture-agent", options(16, 1), |_| async {
        Ok(vec![address])
    })
    .await
    .unwrap();
    assert_eq!(result.status, 302);
    assert_eq!(result.final_url, target.as_str());
    assert!(result.redirect_chain.is_empty());
}

#[tokio::test]
async fn resolver_rejects_non_http_urls_before_dns() {
    for (raw, expected) in [
        ("file:///tmp/report.html", "URL has no host"),
        ("custom://audit.example", "URL has no HTTP port"),
    ] {
        let error = resolve_public_addresses(&Url::parse(raw).unwrap())
            .await
            .unwrap_err();
        assert_eq!(error.to_string(), expected);
    }
}
