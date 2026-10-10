use super::*;
use tauri::{AppHandle, Runtime};

pub struct BuildCrawlResultInput<'a, R: Runtime = tauri::Wry> {
    pub app: &'a AppHandle<R>,
    pub control: &'a CrawlControl,
    pub setup: &'a CrawlSetup,
    pub robots: CrawlRobotsOutcome,
    pub sitemaps: CrawlSitemapsOutcome,
    pub state: &'a mut CrawlLoopState<R>,
    pub resources: Vec<CrawledResource>,
    pub resource_limit_reached: bool,
}
