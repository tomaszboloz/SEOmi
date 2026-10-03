pub(crate) struct FetchedResponse {
    pub(crate) response: FetchedPageBody,
    pub(crate) final_url: String,
    pub(crate) redirect_chain: Vec<super::CrawledRedirectHop>,
    pub(crate) redirect_stopped_reason: Option<String>,
}

pub(crate) enum FetchedPageBody {
    Http(reqwest::Response),
    Rendered(crate::commands::rendered_crawler::RenderedPageSnapshot),
    // Body already read inside the prefetch task. Holding an unread
    // `reqwest::Response` in the prefetch map lets the client's whole-request
    // timeout expire before the sequential loop reaches it.
    Prefetched(Box<FetchedPageData>),
}

pub(crate) struct CrawlFetchFailure {
    pub(crate) kind: String,
    pub(crate) message: String,
}

pub(crate) struct FetchedPageData {
    pub(crate) status: u16,
    pub(crate) content_type: Option<String>,
    pub(crate) content_length: Option<u64>,
    pub(crate) content_encoding: Option<String>,
    pub(crate) http_refresh: Option<String>,
    pub(crate) cache_control: Option<String>,
    pub(crate) charset: Option<String>,
    pub(crate) x_robots_tag: Option<String>,
    pub(crate) declared_html: bool,
    pub(crate) body_truncated: bool,
    pub(crate) body_read_failed: bool,
    pub(crate) body: Vec<u8>,
    pub(crate) rendered_diagnostics: Option<(Vec<String>, Vec<String>)>,
    pub(crate) browser_navigation_time_ms: Option<u64>,
    pub(crate) rendered_lcp_ms: Option<u64>,
    pub(crate) rendered_inp_ms: Option<u64>,
    pub(crate) rendered_cls: Option<f64>,
}
