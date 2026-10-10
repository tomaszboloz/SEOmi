use super::*;

pub struct ExtractPageExtraInput<'a, R: tauri::Runtime = tauri::Wry> {
    pub document: &'a Html,
    pub text: &'a str,
    pub final_base: &'a Url,
    pub final_url: &'a str,
    pub current_parsed: &'a Url,
    pub charset: Option<&'a str>,
    pub is_html: bool,
    pub canonical_selector: &'a Selector,
    pub hreflang_selector: &'a Selector,
    pub setup: &'a CrawlSetup,
    pub state: &'a mut CrawlLoopState<R>,
    pub issues: &'a mut Vec<CrawledPageIssue>,
}
