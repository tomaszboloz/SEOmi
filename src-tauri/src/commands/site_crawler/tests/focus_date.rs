use super::*;
use scraper::Html;

fn date(html: &str) -> Option<String> {
    document_date(&Html::parse_document(html))
}

#[test]
fn meta_tags_json_ld_and_time_elements_are_read_and_newest_wins() {
    let html = "<html><head>\
        <meta property='article:published_time' content='2023-01-05T10:00:00+01:00'>\
        <meta itemprop='dateModified' content='2024-03-09'>\
        <script type='application/ld+json'>{\"dateModified\": \"2025-02-11T08:00:00Z\"}</script>\
        </head><body><time datetime='2022-12-31'>x</time></body></html>";
    assert_eq!(date(html).as_deref(), Some("2025-02-11"));
    assert_eq!(
        date("<body><time datetime='2021-07-04T10:00'>x</time></body>").as_deref(),
        Some("2021-07-04")
    );
}

#[test]
fn implausible_or_missing_dates_are_ignored() {
    assert_eq!(
        date("<head><meta name='date' content='1850-01-01'></head>"),
        None
    );
    assert_eq!(
        date("<head><meta name='date' content='2024-13-40'></head>"),
        None
    );
    assert_eq!(date("<body><p>no dates</p></body>"), None);
    assert_eq!(iso_date("not a date"), None);
}

#[test]
fn http_header_is_the_fallback_only() {
    const RAW: &str = "Wed, 21 Oct 2015 07:28:00 GMT";
    let header = Some(RAW);
    assert_eq!(http_date(RAW).as_deref(), Some("2015-10-21"));
    assert_eq!(http_date("garbage"), None);
    let dated = CrawledPageFocus {
        content_date: Some("2024-01-02".into()),
        ..Default::default()
    };
    assert_eq!(
        dated.dated(header).content_date.as_deref(),
        Some("2024-01-02")
    );
    let filled = CrawledPageFocus::default().dated(header);
    assert_eq!(filled.content_date.as_deref(), Some("2015-10-21"));
    assert_eq!(CrawledPageFocus::default().dated(None).content_date, None);
}
