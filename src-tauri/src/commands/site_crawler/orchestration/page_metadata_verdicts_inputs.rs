use super::*;

pub struct EvaluatePageVerdictsInput<'a> {
    pub status: u16,
    pub response_headers_available: bool,
    pub config: &'a CrawlConfig,
    pub meta_robots: Option<&'a str>,
    pub x_robots_tag: Option<&'a str>,
    pub meta_noindex: bool,
    pub header_noindex: bool,
    pub meta_nofollow: bool,
    pub header_nofollow: bool,
    pub canonical_points_elsewhere: bool,
}
