pub const CHARS: &str = "{0} ({1} characters)";
pub const MS: &str = "{0} ms";
pub const BYTES: &str = "{0} bytes";
pub const MINUTES: &str = "{0} min";
pub const UNKNOWN: &str = "unknown";
pub const MISSING_COUNT: &str = "{0} missing";
pub const FIX_ALT: &str = "Add descriptive alt text to every image.";
pub const FIX_SIZE: &str = "Set explicit width and height attributes on images.";
pub const FIX_INSECURE: &str = "Change http:// links to https://.";
pub const FIX_MIXED: &str = "Load every resource over HTTPS.";
pub const KEYWORD: &str = "{0} ({1})";

pub const META_TITLE: &str = "Meta tags";
pub const TITLE: &str = "Title";
pub const DESCRIPTION: &str = "Meta description";
pub const CANONICAL: &str = "Canonical URL";
pub const ROBOTS_META: &str = "Meta robots";
pub const VIEWPORT: &str = "Viewport";
pub const CHARSET: &str = "Charset";
pub const KEYWORDS: &str = "Meta keywords";
pub const AUTHOR: &str = "Author";
pub const GENERATOR: &str = "Generator";
pub const THEME_COLOR: &str = "Theme color";

pub const HEADINGS_TITLE: &str = "Headings";
pub const H1_COUNT: &str = "H1 count";
pub const H1_TEXT: &str = "H1 text";
pub const HIERARCHY: &str = "Valid heading hierarchy";
pub const OUTLINE: &str = "Heading outline";

pub const CONTENT_TITLE: &str = "Content statistics";
pub const WORDS: &str = "Word count";
pub const SENTENCES: &str = "Sentences";
pub const READING_TIME: &str = "Reading time";
pub const READABILITY: &str = "Readability";
pub const READABILITY_VALUE: &str = "{0} (Flesch score {1})";
pub const WORDS_PER_SENTENCE: &str = "Words per sentence";
pub const TEXT_RATIO: &str = "Text to HTML ratio";
pub const TOP_KEYWORDS: &str = "Top keywords";

pub const IMAGES_TITLE: &str = "Images";
pub const IMAGE_TOTAL: &str = "Images found";
pub const IMAGE_ALT: &str = "Images without alt text";
pub const IMAGE_SIZE: &str = "Images without width and height";
pub const IMAGE_FORMATS: &str = "Image formats";

pub const LINKS_TITLE: &str = "Links";
pub const LINK_TOTAL: &str = "Total links";
pub const LINK_INTERNAL: &str = "Internal links";
pub const LINK_EXTERNAL: &str = "External links";
pub const LINK_NOFOLLOW: &str = "Nofollow links";
pub const LINK_INSECURE: &str = "Insecure (HTTP) links";
pub const LINK_BLANK: &str = "Links opening a new tab";

pub const REDIRECT_TITLE: &str = "Redirect chain";
pub const REDIRECT_HOPS: &str = "Redirect hops";
pub const HOP: &str = "Hop {0}";
pub const HOP_VALUE: &str = "HTTP {0}: {1} to {2}";

pub const INDEX_TITLE: &str = "Indexability";
pub const INDEX_STATUS: &str = "Indexability status";
pub const X_ROBOTS: &str = "X-Robots-Tag header";
pub const CANONICAL_MATCH: &str = "Canonical matches final URL";
pub const CANONICAL_CHECKED: &str = "Canonical target checked";
pub const CANONICAL_STATUS: &str = "Canonical target HTTP status";
pub const CANONICAL_ERROR: &str = "Canonical check error";

pub const SECURITY_TITLE: &str = "Security headers";
pub const SECURITY_SCORE: &str = "Security score";
pub const TRANSPORT_TITLE: &str = "Transport security";
pub const HTTPS: &str = "Served over HTTPS";
pub const SCHEME: &str = "URL scheme";
pub const MIXED: &str = "Mixed content resources";
pub const COOKIES: &str = "Cookies";
pub const NO_COOKIES: &str = "No cookies were set";
pub const COOKIE: &str = "Cookie: {0}";
pub const COOKIE_VALUE: &str = "Secure: {0}; HttpOnly: {1}; SameSite: {2}";
pub const COOKIE_ADVICE: &str = "Set the Secure and HttpOnly flags and a SameSite attribute.";
pub const TLS: &str = "TLS coverage";

pub const STRUCTURED_TITLE: &str = "Structured data";
pub const BLOCKS: &str = "Structured data blocks";
pub const BLOCK: &str = "{0} ({1})";
pub const VALID: &str = "No validation issues";
pub const STRUCTURED_ADVICE: &str = "Fix the structured data so it validates.";

pub const SOCIAL_TITLE: &str = "Open Graph and Twitter card";
pub const ADD_TAG: &str = "Add the {0} tag to the page head.";

pub const A11Y_TITLE: &str = "Accessibility";
pub const LANGUAGE: &str = "Document language";
pub const LANDMARKS: &str = "Landmarks";
pub const ARIA: &str = "ARIA attributes";
pub const FORM_CONTROLS: &str = "Form controls";
pub const UNLABELED: &str = "Unlabeled form controls";
pub const HIDDEN_CONTROLS: &str = "Hidden form controls";
pub const MANUAL: &str = "Manual review needed";

pub const AMP_TITLE: &str = "AMP";
pub const AMP_DETECTED: &str = "AMP detected";
pub const AMP_DOCUMENT: &str = "Page is an AMP document";
pub const AMP_URLS: &str = "AMP versions linked";
pub const AMP_CANONICAL: &str = "AMP canonical URL";
pub const AMP_COVERAGE: &str = "Validation coverage";
pub const NOT_VERIFIED: &str = "Not verified";

pub const PERF_TITLE: &str = "Performance";
pub const HTTP_STATUS: &str = "HTTP status";
pub const RESPONSE_TIME: &str = "Server response time";
pub const HEADERS_TIME: &str = "Time to response headers";
pub const BODY_TIME: &str = "Body read time";
pub const TOTAL_TIME: &str = "Total request time";
pub const BODY_BYTES: &str = "Decoded body size";
pub const LENGTH_HEADER: &str = "Content-Length header";
pub const REDIRECT_COUNT: &str = "Redirects followed";
pub const METHOD: &str = "Request method";
pub const MEASURED_AT: &str = "Measured at";
pub const SCOPE: &str = "Measurement scope";

pub const TECH_TITLE: &str = "Technical details";
pub const CONTENT_TYPE: &str = "Content type";
pub const SERVER: &str = "Server";
pub const FAVICON: &str = "Favicon";
pub const ROBOTS_TXT: &str = "robots.txt";
pub const SITEMAP: &str = "Sitemap";
pub const HREFLANG_TAGS: &str = "Hreflang tags";
pub const HREFLANG: &str = "{0}: {1}";
pub const TECH_SIGNALS: &str = "Detected technologies";
pub const SIGNAL: &str = "{0}{1} ({2}, {3})";
