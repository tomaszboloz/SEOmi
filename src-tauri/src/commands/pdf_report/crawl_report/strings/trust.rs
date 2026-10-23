//! `pdfReport` label keys of the Entity Trust (E-E-A-T) section; text lives in locale files.
//! Code-driven texts (level, severity, finding, kind) are looked up as `<prefix>.<engine code>`.

use super::focus::Coded;

macro_rules! keys {
    ($($name:ident $key:literal,)*) => {
        $(pub const $name: &str = $key;)*
        /// Every static key of the section, checked against `en.json` in tests.
        #[cfg(test)]
        pub const ALL: &[&str] = &[$($key),*];
    };
}

keys! {
    TITLE "crawl.trust.title",
    INTRO "crawl.trust.intro",
    SCORE_TITLE "crawl.trust.scoreTitle",
    LEGEND "crawl.trust.legend",
    K_SCHEMA "crawl.trust.kSchema",
    K_AUTHOR "crawl.trust.kAuthor",
    K_CITATION "crawl.trust.kCitation",
    K_TRANSPARENCY "crawl.trust.kTransparency",
    K_ARTICLES "crawl.trust.kArticles",
    K_AUTHORS "crawl.trust.kAuthors",
    N_LAYER "crawl.trust.nLayer",
    N_NO_DATA "crawl.trust.nNoData",
    N_ARTICLES "crawl.trust.nArticles",
    N_AUTHORS "crawl.trust.nAuthors",
    YMYL_NOTE "crawl.trust.ymylNote",
    T_AUTHORS "crawl.trust.tAuthors",
    AUTHORS_INTRO "crawl.trust.authorsIntro",
    COL_AUTHOR "crawl.trust.colAuthor",
    COL_ARTICLES "crawl.trust.colArticles",
    COL_SAME_AS "crawl.trust.colSameAs",
    COL_ALIGNMENT "crawl.trust.colAlignment",
    GENERIC "crawl.trust.generic",
    T_PAGES "crawl.trust.tPages",
    PAGES_INTRO "crawl.trust.pagesIntro",
    COL_PAGE "crawl.trust.colPage",
    COL_STATE "crawl.trust.colState",
    FOUND "crawl.trust.found",
    MISSING "crawl.trust.missing",
    T_FINDINGS "crawl.trust.tFindings",
    FINDINGS_INTRO "crawl.trust.findingsIntro",
    COL_SEVERITY "crawl.trust.colSeverity",
    COL_FINDING "crawl.trust.colFinding",
}

pub const LEVEL: &str = "crawl.trust.level";
pub const SEVERITY: &str = "crawl.trust.severity";
pub const FIND: &str = "crawl.trust.find";
pub const KIND: &str = "crawl.trust.kind";
pub const YMYL: &str = "crawl.trust.ymyl";

#[cfg(test)]
pub const LEVELS: &[&str] = &["strong", "adequate", "weak", "critical"];
#[cfg(test)]
pub const SEVERITIES: &[&str] = &["critical", "warning", "info"];
/// Trust pages in the order the report lists them.
pub const KINDS: &[&str] = &["editorial", "about", "contact", "registry"];
#[cfg(test)]
pub const YMYLS: &[&str] = &["health", "finance", "legal"];

pub const FINDINGS: &[Coded] = &[
    ("ymyl-unattributed", &["count", "pct"]),
    ("ymyl-no-reviewer", &["count"]),
    ("no-bylines", &["count"]),
    ("generic-author", &["count"]),
    ("org-missing", &[]),
    ("org-no-same-as", &["name"]),
    ("author-no-same-as", &["count", "names"]),
    ("author-no-id", &["count"]),
    ("author-off-topic", &["name", "pct"]),
    ("low-citations", &["pct", "pages"]),
    ("dead-citations", &["count"]),
    ("missing-editorial", &[]),
    ("missing-contact", &[]),
    ("missing-registry", &[]),
    ("missing-about", &[]),
    ("missing-dates", &["pct"]),
    ("no-articles", &[]),
    ("author-invalid-profile", &["count", "names"]),
    ("ymyl-no-scholarly-ids", &["pages"]),
];
