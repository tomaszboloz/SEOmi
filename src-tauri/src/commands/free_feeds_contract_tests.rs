use super::fixture::{malformed_chunked_server, server};
use super::{fetch_public_feed, fetch_public_feed_at, public_feed_url, MAX_PUBLIC_FEED_BYTES};

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap()
}

#[test]
fn builds_only_allowlisted_encoded_feed_urls() {
    let trends = public_feed_url("google-trends", "pl", "", "pl").unwrap();
    assert_eq!(
        trends.as_str(),
        "https://trends.google.com/trending/rss?geo=PL"
    );
    let bing = public_feed_url("bing-serp", "PL", "seo audit & test", "PL-pl").unwrap();
    assert_eq!(bing.host_str(), Some("www.bing.com"));
    assert_eq!(bing.path(), "/search");
    assert_eq!(
        bing.query_pairs().find(|(key, _)| key == "q").unwrap().1,
        "seo audit & test"
    );
    for (feed, geo, keyword, language) in [
        ("evil", "PL", "x", "pl"),
        ("bing-serp", "POL", "x", "pl"),
        ("bing-serp", "PL", "", "pl"),
        ("bing-serp", "PL", "x", "p"),
        ("bing-serp", "PL", "x", "pL-pl-extra"),
        ("bing-serp", "PL", "x", "pl_ PL"),
        ("bing-serp", "PL", "x", "polski-PL-extra"),
    ] {
        assert!(public_feed_url(feed, geo, keyword, language).is_err());
    }
    assert!(public_feed_url("bing-serp", "PL", "x", "pl-PL").is_ok());
    assert!(public_feed_url("bing-serp", "PL", &"x".repeat(501), "pl").is_err());
}

#[tokio::test]
async fn returns_bodies_and_safe_http_outcomes() {
    let (url, done) = server("200 OK", b"<rss/>", true).await;
    let result = fetch_public_feed_at(&client(), url.parse().unwrap()).await;
    done.await.unwrap();
    assert_eq!(result.status, "ok");
    assert_eq!(result.body.as_deref(), Some("<rss/>"));
    assert_eq!(result.http_status, Some(200));
    assert!(!result.fetched_at.is_empty());
    let (url, done) = server("200 OK", b"<rss/>", false).await;
    let result = fetch_public_feed_at(&client(), url.parse().unwrap()).await;
    done.await.unwrap();
    assert_eq!(result.body.as_deref(), Some("<rss/>"));
    for code in [
        "403 Forbidden",
        "429 Too Many Requests",
        "500 Server Error",
        "302 Found",
    ] {
        let (url, done) = server(code, b"private", true).await;
        let result = fetch_public_feed_at(&client(), url.parse().unwrap()).await;
        done.await.unwrap();
        assert_eq!(
            result.status,
            if code.starts_with("403") || code.starts_with("429") {
                "blocked"
            } else {
                "error"
            }
        );
        assert!(result.body.is_none());
        assert!(result.error.is_some());
    }
}

#[tokio::test]
async fn suggestions_transport_preserves_json_payload() {
    let (url, done) = server("200 OK", br#"["seo"]"#, true).await;
    let result = fetch_public_feed_at(&client(), url.parse().unwrap()).await;
    done.await.unwrap();
    assert_eq!(result.status, "ok");
    assert_eq!(result.body.as_deref(), Some(r#"["seo"]"#));
}

#[tokio::test]
async fn enforces_stream_byte_limit() {
    let (url, done) = server("200 OK", b"12345", false).await;
    let response = client().get(url).send().await.unwrap();
    let error = super::network::bounded_body(response, 4).await.unwrap_err();
    done.await.unwrap();
    assert_eq!(error, "Public feed body exceeds the byte limit.");
}

#[tokio::test]
async fn bounds_response_body_and_rejects_transport_failures() {
    let too_large = vec![b'x'; MAX_PUBLIC_FEED_BYTES + 1];
    let (url, done) = server("200 OK", &too_large, true).await;
    let result = fetch_public_feed_at(&client(), url.parse().unwrap()).await;
    done.await.unwrap();
    assert_eq!(result.status, "error");
    assert!(result.error.unwrap().contains("byte"));
    let (url, done) = server("200 OK", &too_large, false).await;
    let result = fetch_public_feed_at(&client(), url.parse().unwrap()).await;
    done.await.unwrap();
    assert_eq!(
        result.error.as_deref(),
        Some("Public feed body exceeds the byte limit.")
    );
    let result = fetch_public_feed_at(&client(), "http://127.0.0.1:9".parse().unwrap()).await;
    assert_eq!(result.status, "error");
    assert_eq!(result.error.as_deref(), Some("Public feed request failed."));
}

#[tokio::test]
async fn rejects_invalid_utf8_and_malformed_chunk_streams() {
    let (url, done) = server("200 OK", &[0xff, 0xfe], true).await;
    let result = fetch_public_feed_at(&client(), url.parse().unwrap()).await;
    done.await.unwrap();
    assert_eq!(result.status, "error");
    assert_eq!(
        result.error.as_deref(),
        Some("Public feed body is not valid UTF-8.")
    );

    let (url, done) = malformed_chunked_server().await;
    let result = fetch_public_feed_at(&client(), url.parse().unwrap()).await;
    done.await.unwrap();
    assert_eq!(result.status, "error");
    assert_eq!(
        result.error.as_deref(),
        Some("Public feed body could not be read.")
    );
}

#[tokio::test]
async fn command_validates_before_network() {
    assert!(
        fetch_public_feed("bad".into(), "PL".into(), "x".into(), "pl".into())
            .await
            .is_err()
    );
    assert!(
        fetch_public_feed("bing-serp".into(), "PL".into(), "".into(), "pl".into())
            .await
            .is_err()
    );
}
