//! `pdfReport` label keys of the URL protection table (#81); text lives in locale files.
//! Code-driven texts are looked up as `<prefix>.<code>`; templates use `{{0}}`, `{{1}}`.

macro_rules! keys {
    ($($name:ident => $key:literal,)*) => {
        $(pub const $name: &str = $key;)*
        /// Every static key of the table, checked against `en.json` in tests.
        #[cfg(test)]
        pub const ALL: &[&str] = &[$($key),*];
    };
}

keys! {
    TITLE => "crawl.focus.protection.title",
    INTRO => "crawl.focus.protection.intro",
    NO_TELEMETRY => "crawl.focus.protection.noTelemetry",
    COL_DECISION => "crawl.focus.protection.colDecision",
    COL_EVIDENCE => "crawl.focus.protection.colEvidence",
    COL_OPTIONS => "crawl.focus.protection.colOptions",
    UNKNOWN => "crawl.focus.protection.unknown",
    MEASURED => "crawl.focus.protection.measured",
    ONLY_IF => "crawl.focus.protection.onlyIf",
}

pub const DECISION: &str = "crawl.focus.protection.decision";
pub const REASON: &str = "crawl.focus.protection.reason";
pub const SIGNAL: &str = "crawl.focus.protection.signal";
pub const STATE: &str = "crawl.focus.protection.state";
pub const ALTERNATIVE: &str = "crawl.focus.protection.alternative";
pub const CONDITION: &str = "crawl.focus.protection.condition";

/// Codes the TypeScript engine can emit, per prefix; each needs an `en.json` text.
#[cfg(test)]
pub const CODES: &[(&str, &[&str])] = &[
    (
        DECISION,
        &[
            "keep",
            "shield",
            "needs-data",
            "semantic-bridge",
            "prune-candidate",
        ],
    ),
    (
        REASON,
        &[
            "trs-above-threshold",
            "revenue",
            "conversions",
            "pri-above-threshold",
            "telemetry-incomplete",
            "low-pri-measured",
        ],
    ),
    (
        SIGNAL,
        &["clicks", "conversions", "referringDomains", "revenue"],
    ),
    (
        STATE,
        &[
            "measured",
            "missing-permission",
            "partial-history",
            "stale",
            "sampled",
            "unavailable",
        ],
    ),
    (
        ALTERNATIVE,
        &[
            "confirm-revenue-currency",
            "check-gsc-ga4-backlinks-access",
            "link-to-pillar",
            "redirect-301-to-relevant-target",
            "canonical-for-duplicates",
            "keep-and-rewrite",
            "noindex-or-410-after-review",
        ],
    ),
    (
        CONDITION,
        &[
            "currency-from-analytics",
            "fresh-90-day-window",
            "real-topic-relation",
            "relevant-target-same-intent",
            "no-measured-value",
            "update-links-and-sitemap",
            "near-duplicate-only",
            "owner-confirms-value",
            "not-via-robots-txt",
            "business-review",
        ],
    ),
];
