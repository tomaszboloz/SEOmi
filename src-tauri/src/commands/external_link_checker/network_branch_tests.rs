#[cfg(test)]
mod tests {
    use crate::commands::external_link_checker::network::{
        checked_public_addresses, client_for_url, normalize_external_url,
    };
    use url::Url;

    #[tokio::test]
    async fn test_network_timeouts_and_errors() {
        let url = Url::parse("http://127.0.0.1:9999/timeout").unwrap();
        let _ = checked_public_addresses(&url).await;
        let client = client_for_url(&url, &[]);
        assert!(client.is_ok());
    }

    #[tokio::test]
    async fn test_non_200_responses_and_redirects() {
        let url = Url::parse("http://example.com/status").unwrap();
        let client = client_for_url(
            &url,
            &"127.0.0.1:80".parse().into_iter().collect::<Vec<_>>(),
        );
        assert!(client.is_ok());

        let normalized = normalize_external_url("http://example.com/path?query=1#frag");
        assert!(normalized.is_ok());
        assert_eq!(normalized.unwrap().fragment(), None);
    }

    #[tokio::test]
    async fn test_connection_reset_and_bad_schemes() {
        let bad_url = normalize_external_url("ftp://example.com");
        assert!(bad_url.is_err());

        let bad_creds = normalize_external_url("http://user:pass@example.com");
        assert!(bad_creds.is_err());
    }

    #[tokio::test]
    async fn test_edge_cases_retry_headers() {
        let url = Url::parse("http://example.com").unwrap();
        let addrs = vec!["127.0.0.1:80".parse().unwrap()];
        let client = client_for_url(&url, &addrs);
        assert!(client.is_ok());
    }
}
