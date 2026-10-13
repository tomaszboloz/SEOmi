pub use super::labels_cols::*;

pub const T_RUN: &str = "Run details";
pub const T_CONFIG: &str = "Crawl configuration";
pub const CONFIG_INTRO: &str = "Settings the crawl ran with, exactly as stored in the run.";
pub const T_ROBOTS: &str = "Robots.txt and sitemap";
pub const RUN_ID: &str = "Run ID";
pub const SCOPE_URL: &str = "Scope start URL";
pub const START_URL: &str = "Start URL used by the crawler";
pub const RESOURCES: &str = "Resources checked";
pub const IMAGES: &str = "Images found";
pub const LIMITS: &str = "Limits observed";
pub const CANCELLED: &str = "Cancelled";
pub const TIMED_OUT: &str = "Timed out";
pub const RESOURCE_LIMIT: &str = "Resource request limit reached";
pub const PROVENANCE: &str = "Discovery provenance partial";
pub const COMPACTED: &str = "Stored evidence compacted";
pub const PAGES_TRUNCATED: &str = "Stored pages truncated";
pub const STORAGE_PAGES: &str = "{0} of {1} pages kept";
pub const TEMPLATE: &str = "Report template";
pub const TEMPLATE_FULL: &str = "Full report";
pub const ROBOTS_STATUS: &str = "robots.txt status";
pub const ROBOTS_EVAL: &str = "robots.txt evaluation";
pub const ROBOTS_CODE: &str = "robots.txt HTTP status";
pub const ROBOTS_URL: &str = "robots.txt final URL";
pub const ROBOTS_AGENT: &str = "Crawler user agent";
pub const ROBOTS_BLOCKED: &str = "URLs blocked by robots.txt";
pub const ROBOTS_WARNING: &str = "robots.txt warning";
pub const SITEMAP_STATUS: &str = "Sitemap result";
pub const SITEMAP_FOUND: &str = "Sitemap URLs discovered";

pub const T_PAGES: &str = "All crawled pages";

pub const T_DUP_TITLES: &str = "Duplicate titles";
pub const T_DUP_DESCRIPTIONS: &str = "Duplicate meta descriptions";
pub const T_DUP_CONTENT: &str = "Duplicate content";
pub const T_NEAR: &str = "Near-duplicate content";
pub const DUP_INTRO: &str = "Pages in the same group share the same value; make each page unique.";
pub const HASH_LABEL: &str = "Content hash {0} ({1})";
pub const T_REDIRECTS: &str = "Redirects and redirect chains";
pub const REDIRECT_INTRO: &str =
    "Link directly to the final URL; chains of 2 or more hops waste crawl budget.";
pub const HOP: &str = "{0} \u{2192} {1}";
pub const T_CLIENT_REDIRECTS: &str = "Client-side redirects";
pub const T_BROKEN: &str = "Broken links";
pub const BROKEN_INTRO: &str =
    "Links whose target answered with an error or could not be requested; internal links first.";
pub const INTERNAL: &str = "Internal";
pub const EXTERNAL: &str = "External";
pub const STATUS_ERROR: &str = "{0} ({1})";
pub const T_EXTERNAL: &str = "External links summary";
pub const EXTERNAL_INTRO: &str =
    "External targets grouped by host, with the results of the checks done in this run.";
pub const NOT_CHECKED: &str = "not checked in this run";
pub const T_CANONICAL: &str = "Canonical conflicts";
pub const CANONICAL_INTRO: &str =
    "Pages whose canonical is missing, invalid, multiple or points elsewhere.";
pub const TARGET_STATUS: &str = "{0} (HTTP {1})";
pub const RD_COMPLETED: &str = "Completed at";
pub const RD_MODE: &str = "Crawl mode";
pub const RD_DURATION: &str = "Duration";
pub const RD_PAGES: &str = "Pages crawled";
pub const T_HREFLANG: &str = "Hreflang";
pub const T_PAGINATION: &str = "Pagination";
pub const T_AMP: &str = "AMP";
pub const T_SCHEMA: &str = "Structured data";
pub const SCHEMA_FINDING: &str = "{0} {1}: {2}";
pub const T_HTML: &str = "HTML validation findings";
pub const LINE_COLUMN: &str = "(line {0}, column {1})";
pub const T_IMAGES: &str = "Image problems";
pub const IMAGES_INTRO: &str =
    "{0} of {1} images have a problem: missing alt text or dimensions, errors or oversized files.";
pub const P_NO_ALT: &str = "no alt";
pub const P_NO_SIZE: &str = "no width/height";
pub const P_BROKEN: &str = "request failed";
pub const P_OVERSIZED: &str = "over {0} KB";
pub const T_RESOURCES: &str = "Resources";
pub const USED_BY: &str = "{0} pages, e.g. {1}";
pub const T_FRAMES: &str = "Frames (iframes)";
pub const T_SEARCHES: &str = "Custom search results";
pub const T_RULES: &str = "robots.txt rules applying to the crawler";
pub const T_AGENTS: &str = "robots.txt by crawler identity";
pub const T_DIRECTIVES: &str = "Sitemap directives in robots.txt";
pub const T_ROBOTS_CHAIN: &str = "robots.txt redirect chain";
pub const T_SITEMAP_URLS: &str = "Sitemap URLs in scope";
pub const T_REJECTED: &str = "URLs rejected by the crawl scope";
pub const T_REASONS: &str = "Indexability reasons";
pub const REASONS_INTRO: &str = "Why pages are blocked or uncertain, including robots.txt rules.";
pub const HTTP_INTRO: &str =
    "{0} of {1} pages returned header or discovery data; the others carry none.";
pub const T_HTTP: &str = "HTTP response details and discovery";
pub const DISCOVERED: &str = "{0} {1}";
