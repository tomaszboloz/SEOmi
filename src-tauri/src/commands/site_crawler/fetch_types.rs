pub(super) struct FetchedResponse {
    pub(super) response: FetchedPageBody,
    pub(super) final_url: String,
    pub(super) redirect_chain: Vec<super::CrawledRedirectHop>,
    pub(super) redirect_stopped_reason: Option<String>,
}

pub(super) enum FetchedPageBody {
    Http(reqwest::Response),
    Rendered(crate::commands::rendered_crawler::RenderedPageSnapshot),
    // Body already read inside the prefetch task. Holding an unread
    // `reqwest::Response` in the prefetch map lets the client's whole-request
    // timeout expire before the sequential loop reaches it.
    Prefetched(Box<FetchedPageData>),
}

pub(super) struct CrawlFetchFailure {
    pub(super) kind: String,
    pub(super) message: String,
}

pub(super) struct FetchedPageData {
    pub(super) status: u16,
    pub(super) content_type: Option<String>,
    pub(super) content_length: Option<u64>,
    pub(super) content_encoding: Option<String>,
    pub(super) http_refresh: Option<String>,
    pub(super) cache_control: Option<String>,
    pub(super) charset: Option<String>,
    pub(super) x_robots_tag: Option<String>,
    pub(super) declared_html: bool,
    pub(super) body_truncated: bool,
    pub(super) body_read_failed: bool,
    pub(super) body: Vec<u8>,
    pub(super) rendered_diagnostics: Option<(Vec<String>, Vec<String>)>,
    pub(super) browser_navigation_time_ms: Option<u64>,
    pub(super) rendered_lcp_ms: Option<u64>,
    pub(super) rendered_inp_ms: Option<u64>,
    pub(super) rendered_cls: Option<f64>,
}
