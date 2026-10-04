use super::*;

pub struct BuildCrawlResultInput<'a> {
    pub app: &'a AppHandle,
    pub control: &'a CrawlControl,
    pub setup: &'a CrawlSetup,
    pub robots: CrawlRobotsOutcome,
    pub sitemaps: CrawlSitemapsOutcome,
    pub state: &'a mut CrawlLoopState,
    pub resources: Vec<CrawledResource>,
    pub resource_limit_reached: bool,
}
