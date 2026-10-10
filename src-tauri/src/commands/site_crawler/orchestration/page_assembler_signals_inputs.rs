use super::*;

pub struct ExtractPageSignalsInput<'a, R: tauri::Runtime = tauri::Wry> {
    pub document: &'a Html,
    pub text: &'a str,
    pub page_data: &'a FetchedPageData,
    pub final_base: &'a Url,
    pub final_url: &'a str,
    pub current_url: &'a str,
    pub current_parsed: &'a Url,
    pub depth: usize,
    pub redirect_chain_len: usize,
    pub redirect_stopped_reason: Option<&'a String>,
    pub is_html: bool,
    pub selectors: &'a CrawlSelectors,
    pub setup: &'a CrawlSetup,
    pub state: &'a mut CrawlLoopState<R>,
    pub issues: &'a mut Vec<CrawledPageIssue>,
}
