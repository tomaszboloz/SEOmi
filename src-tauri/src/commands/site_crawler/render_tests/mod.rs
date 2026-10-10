use super::*;
use crate::commands::site_crawler::render_health::RenderHealth;
use std::collections::VecDeque;

fn page_data(status: u16, declared_html: bool, headers: bool) -> FetchedPageData {
    FetchedPageData {
        status,
        http_response_url: Some("https://example.com/file".into()),
        response_url_mismatch: false,
        content_type: Some("text/html".into()),
        content_disposition: None,
        content_length: None,
        content_encoding: None,
        http_refresh: None,
        cache_control: None,
        charset: None,
        x_robots_tag: None,
        declared_html,
        body_truncated: false,
        body_read_failed: false,
        body: Vec::new(),
        rendered_diagnostics: None,
        browser_navigation_time_ms: None,
        rendered_lcp_ms: None,
        rendered_inp_ms: None,
        rendered_cls: None,
        response_headers_available: headers,
        render_fallback: None,
    }
}

/// Scripted renderer: returns the queued results and counts the calls.
struct FakeRenderer {
    results: VecDeque<Result<RenderedPageSnapshot, String>>,
    rendered_urls: Vec<String>,
}

impl FakeRenderer {
    fn returning(results: Vec<Result<RenderedPageSnapshot, String>>) -> Self {
        Self {
            results: results.into(),
            rendered_urls: Vec::new(),
        }
    }
}

impl PageRenderer for FakeRenderer {
    async fn render(&mut self, url: &str) -> Result<RenderedPageSnapshot, String> {
        self.rendered_urls.push(url.to_owned());
        self.results
            .pop_front()
            .expect("the renderer was called more often than the test scripted")
    }
}

fn snapshot(final_url: &str, html: &str) -> RenderedPageSnapshot {
    RenderedPageSnapshot {
        requested_url: final_url.into(),
        final_url: final_url.into(),
        http_status: None,
        content_type: "text/html".into(),
        charset: "UTF-8".into(),
        html: html.into(),
        html_truncated: false,
        navigation_time_ms: Some(120),
        lcp_ms: Some(300),
        inp_ms: None,
        cls: None,
        failed_resource_urls: Vec::new(),
        console_errors: Vec::new(),
    }
}

mod decision;
mod decision_edges;
mod delay;
mod fetch;
mod health;
mod merge;
