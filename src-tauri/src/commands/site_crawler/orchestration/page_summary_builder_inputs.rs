use super::*;

pub struct BuildCrawledPageSummaryInput<'a> {
    pub final_url: String,
    pub redirect_chain: Vec<super::super::super::models::CrawledRedirectHop>,
    pub redirect_stopped_reason: Option<String>,
    pub page_data: &'a FetchedPageData,
    pub page_duration: u64,
    pub current_url: &'a str,
    pub depth: usize,
    pub crawl_mode: &'a str,
    pub detected_charset: Option<String>,
    pub cm: &'a ContentMetrics,
    pub focus_phrase: Option<crate::commands::site_crawler::models::CrawledFocusPhraseEvidence>,
    pub extra: PageExtraOutcome,
    pub content: PageContentOutcome,
    pub meta: PageMetadataOutcome,
    pub links: PageLinksOutcome,
    pub images: Vec<CrawledImage>,
    pub discovery_sources: Vec<crate::commands::site_crawler::models::CrawledDiscoverySource>,
    pub issues: Vec<CrawledPageIssue>,
}
