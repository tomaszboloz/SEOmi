use super::*;

pub struct ExtractPageContentInput<'a> {
    pub document: &'a Html,
    pub page_url: &'a str,
    pub crawl_mode: &'a str,
    pub body_len: usize,
    pub status: u16,
    pub is_html: bool,
    pub body_truncated: bool,
    pub body_read_failed: bool,
    pub html_selector: &'a Selector,
    pub title_selector: &'a Selector,
    pub h1_selector: &'a Selector,
    pub headings_selector: &'a Selector,
    pub meta_desc_selector: &'a Selector,
    pub issues: &'a mut Vec<CrawledPageIssue>,
}
