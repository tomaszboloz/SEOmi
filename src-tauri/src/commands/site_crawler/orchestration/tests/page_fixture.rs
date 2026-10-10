use super::super::super::fetch_types::FetchedPageData;
use super::super::super::models::{CrawledPageIssue, CrawledRedirectHop};
use super::super::page_assembler_signals::{
    extract_page_signals, AssembledPageSignals, ExtractPageSignalsInput,
};
use super::super::page_summary_builder::{
    build_crawled_page_summary, BuildCrawledPageSummaryInput,
};
use super::*;
use scraper::Html;
use url::Url;

pub(super) const FINAL_URL: &str = "https://example.test/article";
pub(super) const CURRENT_URL: &str = "https://example.test/old";
pub(super) const HTML: &str = r##"<!doctype html><html lang="en"><head>
<meta charset="utf-8"><title>Crawl evidence</title>
<meta name="description" content="Review crawl evidence carefully.">
<link rel="canonical" href="/article"><link rel="next" href="/article?page=2">
<link rel="alternate" hreflang="pl" href="/pl/article">
<link rel="amphtml" href="/article/amp"><link rel="icon" href="/favicon.ico">
<meta property="og:title" content="Observed social title">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Crawl evidence"}</script>
</head><body><nav><a href="/menu">Menu</a></nav><main>
<h1>Crawl evidence</h1><h2>Details</h2><h2>Details</h2>
<p>Clear records help teams inspect crawl evidence and understand indexing signals.
Reliable measurements explain what the crawler observed during this particular run.
Missing observations remain unknown so reports never invent successful target checks.
Readers can compare page text with links and metadata before changing content.
Every result retains its source and timing for later review by project owners.</p>
<a href="/next">Next article</a><a href="https://outside.test/">External source</a>
<a href="/nofollow" rel="NOFOLLOW">Restricted follow</a>
<a href="#part">Section</a><a href="mailto:mail@example.test">Mail</a>
<img src="/image.png" alt="Evidence diagram" width="100" height="50">
<iframe src="/frame" title="Related evidence"></iframe>
</main></body></html>"##;

pub(super) fn data(text: &str) -> FetchedPageData {
    FetchedPageData {
        status: 200,
        http_response_url: Some(CURRENT_URL.into()),
        response_url_mismatch: false,
        content_type: Some("text/html".into()),
        content_disposition: None,
        content_length: Some(text.len() as u64),
        content_encoding: Some("gzip".into()),
        http_refresh: None,
        cache_control: Some("max-age=60".into()),
        charset: Some("utf-8".into()),
        x_robots_tag: None,
        declared_html: true,
        body_truncated: false,
        body_read_failed: false,
        body: text.as_bytes().to_vec(),
        rendered_diagnostics: None,
        browser_navigation_time_ms: None,
        rendered_lcp_ms: None,
        rendered_inp_ms: None,
        rendered_cls: None,
        response_headers_available: true,
        render_fallback: None,
    }
}

pub(super) fn signals(
    page_data: &FetchedPageData,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState,
    issues: &mut Vec<CrawledPageIssue>,
) -> AssembledPageSignals {
    let text = String::from_utf8_lossy(&page_data.body);
    let document = Html::parse_document(&text);
    let final_base = Url::parse(FINAL_URL).unwrap();
    extract_page_signals(ExtractPageSignalsInput {
        document: &document,
        text: &text,
        page_data,
        final_base: &final_base,
        final_url: FINAL_URL,
        current_url: CURRENT_URL,
        current_parsed: &Url::parse(CURRENT_URL).unwrap(),
        depth: 2,
        redirect_chain_len: 1,
        redirect_stopped_reason: None,
        is_html: page_data.declared_html
            && !page_data.body_truncated
            && !page_data.body_read_failed,
        selectors: &CrawlSelectors::compile(),
        setup,
        state,
        issues,
    })
}

pub(super) fn hop() -> CrawledRedirectHop {
    CrawledRedirectHop {
        from_url: CURRENT_URL.into(),
        http_status: 301,
        to_url: FINAL_URL.into(),
        response_time_ms: Some(17),
    }
}

pub(super) fn summary(
    page_data: &FetchedPageData,
    signals: AssembledPageSignals,
    issues: Vec<CrawledPageIssue>,
    mode: &str,
) -> super::super::super::models::CrawledPageSummary {
    build_crawled_page_summary(BuildCrawledPageSummaryInput {
        final_url: FINAL_URL.into(),
        redirect_chain: vec![hop()],
        redirect_stopped_reason: Some("observed-stop".into()),
        page_data,
        page_duration: 83,
        current_url: CURRENT_URL,
        depth: 2,
        crawl_mode: mode,
        detected_charset: Some("UTF-8".into()),
        cm: &signals.cm,
        focus_phrase: signals.focus_phrase,
        extra: signals.extra,
        content: signals.content,
        meta: signals.meta,
        links: signals.links,
        images: signals.images,
        discovery_sources: vec![source("resume")],
        issues,
    })
}
