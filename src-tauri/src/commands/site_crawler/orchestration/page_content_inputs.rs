use super::*;

pub struct ExtractPageContentInput<'a> {
    pub document: &'a Html,
    pub body_len: usize,
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
