use super::*;

pub struct ExtractPageLinksInput<'a, R: tauri::Runtime = tauri::Wry> {
    pub document: &'a Html,
    pub final_base: &'a Url,
    pub final_url: &'a str,
    pub depth: usize,
    pub has_primary_content_root: bool,
    pub a_selector: &'a Selector,
    pub setup: &'a CrawlSetup,
    pub state: &'a mut CrawlLoopState<R>,
}
