use super::*;

pub struct ExtractPageAssetsInput<'a> {
    pub document: &'a Html,
    pub final_base: &'a Url,
    pub final_url: &'a str,
    pub depth: usize,
    pub has_primary_content_root: bool,
    pub is_html: bool,
    pub extra: &'a PageExtraOutcome,
    pub selectors: &'a CrawlSelectors,
    pub setup: &'a CrawlSetup,
    pub state: &'a mut CrawlLoopState,
    pub issues: &'a mut Vec<CrawledPageIssue>,
}
