use super::*;

pub struct RegisterPageResourceCandidatesInput<'a, R: tauri::Runtime = tauri::Wry> {
    pub document: &'a Html,
    pub final_base: &'a Url,
    pub final_url: &'a str,
    pub frames: &'a [CrawledFrame],
    pub script_src_selector: &'a Selector,
    pub link_href_selector: &'a Selector,
    pub media_src_selector: &'a Selector,
    pub setup: &'a CrawlSetup,
    pub state: &'a mut CrawlLoopState<R>,
}
