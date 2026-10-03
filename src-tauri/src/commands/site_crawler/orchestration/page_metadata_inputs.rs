use super::*;

pub struct ExtractPageMetadataInput<'a> {
    pub page_data: &'a FetchedPageData,
    pub document: &'a Html,
    pub final_base: &'a Url,
    pub final_url: &'a str,
    pub current_url: &'a str,
    pub redirect_chain_len: usize,
    pub redirect_stopped_reason: Option<&'a String>,
    pub pagination_declaration_count: usize,
    pub pagination_invalid_declaration_count: usize,
    pub config: &'a CrawlConfig,
    pub robots_selector: &'a Selector,
    pub meta_refresh_selector: &'a Selector,
    pub issues: &'a mut Vec<CrawledPageIssue>,
}
