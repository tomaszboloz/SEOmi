//! `pdfReport` label keys of the Site Focus section; text lives in the locale files.
//! Code-driven texts (band, recommendation, option, gap, note, status, type) are
//! looked up as `<prefix>.<engine code>`; templates use `{{0}}`, `{{1}}` placeholders.

macro_rules! keys {
    ($($name:ident => $key:literal,)*) => {
        $(pub const $name: &str = $key;)*
        /// Every static key of this section, checked against `en.json` in tests.
        #[cfg(test)]
        pub const ALL: &[&str] = &[$($key),*];
    };
}

keys! {
    TITLE => "crawl.focus.title",
    INTRO => "crawl.focus.intro",
    SCORE_TITLE => "crawl.focus.scoreTitle",
    LEGEND => "crawl.focus.legend",
    K_CONFIDENCE => "crawl.focus.kConfidence",
    K_ON_TOPIC => "crawl.focus.kOnTopic",
    K_SCORED => "crawl.focus.kScored",
    K_SKIPPED => "crawl.focus.kSkipped",
    K_OFF_TOPIC => "crawl.focus.kOffTopic",
    K_BORDERLINE => "crawl.focus.kBorderline",
    K_STRONG => "crawl.focus.kStrong",
    N_CONFIDENCE => "crawl.focus.nConfidence",
    N_ON_TOPIC => "crawl.focus.nOnTopic",
    N_SCORED => "crawl.focus.nScored",
    N_SKIPPED => "crawl.focus.nSkipped",
    N_OFF_TOPIC => "crawl.focus.nOffTopic",
    N_BORDERLINE => "crawl.focus.nBorderline",
    N_STRONG => "crawl.focus.nStrong",
    PERCENT => "crawl.focus.percent",
    CORE_BADGE => "crawl.focus.coreBadge",
    CORE_TERMS => "crawl.focus.coreTerms",
    CORE_TERM => "crawl.focus.coreTerm",
    CORE_CONFIDENCE => "crawl.focus.coreConfidence",
    CORE_MANUAL => "crawl.focus.coreManual",
    CORE_DETECTED => "crawl.focus.coreDetected",
    T_PAGES => "crawl.focus.tPages",
    PAGES_INTRO => "crawl.focus.pagesIntro",
    COL_TRS => "crawl.focus.colTrs",
    COL_TYPE => "crawl.focus.colType",
    COL_SIMILARITY => "crawl.focus.colSimilarity",
    COL_OVERLAP => "crawl.focus.colOverlap",
    COL_DRIFT => "crawl.focus.colDrift",
    COL_PLAYBOOK => "crawl.focus.colPlaybook",
    PLAYBOOK => "crawl.focus.playbook",
    T_RECS => "crawl.focus.tRecs",
    RECS_INTRO => "crawl.focus.recsIntro",
    COL_NO => "crawl.focus.colNo",
    COL_ACTION => "crawl.focus.colAction",
    COL_GAIN => "crawl.focus.colGain",
    GAIN => "crawl.focus.gain",
    T_SUB => "crawl.focus.tSub",
    SUB_INTRO => "crawl.focus.subIntro",
    COL_AREA => "crawl.focus.colArea",
    COL_PREFIX => "crawl.focus.colPrefix",
    COL_SHARE => "crawl.focus.colShare",
    COL_SCORE => "crawl.focus.colScore",
    T_GAPS => "crawl.focus.tGaps",
    COL_GAP => "crawl.focus.colGap",
}

pub const BAND: &str = "crawl.focus.band";
pub const NOTE: &str = "crawl.focus.note";
pub const REC: &str = "crawl.focus.rec";
pub const OPTION: &str = "crawl.focus.option";
pub const GAP: &str = "crawl.focus.gap";
pub const STATUS: &str = "crawl.focus.status";
pub const TYPE: &str = "crawl.focus.type";

#[cfg(test)]
pub const BANDS: &[&str] = &["excellent", "good", "moderate", "weak", "critical"];
#[cfg(test)]
pub const NOTES: &[&str] = &[
    "lowConfidence",
    "multiTopic",
    "lexicalFallback",
    "skippedRender",
    "degraded",
    "unmatchedTopic",
    "anchoredTopic",
    "anchorsMissing",
    "goalTopic",
    "goalUnmatched",
];
#[cfg(test)]
pub const STATUSES: &[&str] = &["strong", "moderate", "borderline", "weak", "off-topic"];
#[cfg(test)]
pub const TYPES: &[&str] = &["homepage", "category", "article", "technical"];

/// Engine code and the names of its parameters, in `{{0}}`, `{{1}}` order.
pub type Coded = (&'static str, &'static [&'static str]);

pub const RECS: &[Coded] = &[
    ("remove-offtopic", &["count", "gain"]),
    ("strengthen-borderline", &["count", "target", "gain"]),
    ("expand-core-cluster", &["count", "gain"]),
    ("add-internal-links", &["count"]),
    ("collect-more-pages", &["pageCount"]),
    ("split-subsites", &["count"]),
    ("review-skipped-pages", &["count", "timeouts"]),
    ("monitor-strong-pages", &["count"]),
];

pub const OPTIONS: &[Coded] = &[
    ("remove-redirect", &["gain"]),
    ("noindex-isolate", &["gain"]),
    ("rewrite-on-topic", &["target"]),
    ("add-missing-terms", &["terms"]),
    ("reinforce-headings", &[]),
    ("deepen-coverage", &[]),
    ("serve-as-hub", &[]),
    ("build-satellite-cluster", &[]),
    ("monitor-periodically", &["weeks"]),
];
