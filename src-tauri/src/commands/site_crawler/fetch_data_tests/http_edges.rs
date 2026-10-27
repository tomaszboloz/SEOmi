use super::*;

#[tokio::test]
async fn missing_content_type_defaults_to_declared_html() {
    let result = read_fetched_page_data(
        FetchedPageBody::Http(response("", b"<h1>No Content-Type</h1>").await),
        100,
    )
    .await;
    assert!(result.declared_html);
    assert_eq!(result.content_type, None);
    assert_eq!(result.charset, None);
    assert_eq!(result.body, b"<h1>No Content-Type</h1>");
    assert!(!result.body_truncated);
}

#[tokio::test]
async fn whitespace_and_empty_directives_are_filtered() {
    let headers = "Refresh:   \r\nX-Robots-Tag:  \r\nCache-Control: public\r\n";
    let result =
        read_fetched_page_data(FetchedPageBody::Http(response(headers, b"test").await), 100).await;
    assert!(result.http_refresh.is_none());
    assert!(result.x_robots_tag.is_none());
    assert_eq!(result.cache_control.as_deref(), Some("public"));
}

#[tokio::test]
async fn charset_extraction_handles_varied_parameter_formats() {
    for (content_type, expected_charset) in [
        ("text/html; charset=ISO-8859-1", Some("ISO-8859-1")),
        ("text/html; foo=bar; Charset=utf-8", Some("utf-8")),
        ("text/html; charset=", Some("")),
        ("text/html; no_charset", None),
    ] {
        let header = format!("Content-Type: {content_type}\r\n");
        let result =
            read_fetched_page_data(FetchedPageBody::Http(response(&header, b"").await), 100).await;
        assert_eq!(
            result.charset.as_deref(),
            expected_charset,
            "for {content_type}"
        );
    }
}

#[tokio::test]
async fn content_length_exceeding_max_bytes_skips_reading_chunks() {
    let headers = "Content-Type: text/html\r\nContent-Length: 100000\r\n";
    let result = read_fetched_page_data(
        FetchedPageBody::Http(response(headers, b"short body").await),
        50,
    )
    .await;
    assert!(result.body_truncated);
    assert!(result.body.is_empty());
}
