//! `pdfReport` label keys of the Topical Authority section; text lives in the locale files.
//! Code-driven texts (quadrant, warning, level, recommendation) are looked up as
//! `<prefix>.<engine code>`; templates use `{{0}}`, `{{1}}` placeholders.

use super::focus::Coded;

macro_rules! keys {
    ($($name:ident => $key:literal,)*) => {
        $(pub const $name: &str = $key;)*
        /// Every static key of this section, checked against `en.json` in tests.
        #[cfg(test)]
        pub const ALL: &[&str] = &[$($key),*];
    };
}

keys! {
    TITLE => "crawl.authority.title",
    INTRO => "crawl.authority.intro",
    SCORE_TITLE => "crawl.authority.scoreTitle",
    LEGEND => "crawl.authority.legend",
    K_TCR => "crawl.authority.kTcr",
    K_CDES => "crawl.authority.kCdes",
    K_SILC => "crawl.authority.kSilc",
    K_CVFF => "crawl.authority.kCvff",
    UNAVAILABLE => "crawl.authority.unavailable",
    NO_REFERENCE => "crawl.authority.noReference",
    T_COVERAGE => "crawl.authority.tCoverage",
    COL_PILLAR => "crawl.authority.colPillar",
    COL_COVERAGE => "crawl.authority.colCoverage",
    COL_GAPS => "crawl.authority.colGaps",
    T_GAPS => "crawl.authority.tGaps",
    COL_GAP => "crawl.authority.colGap",
    COL_LEVEL => "crawl.authority.colLevel",
    T_CANNIBAL => "crawl.authority.tCannibal",
    COL_CANONICAL => "crawl.authority.colCanonical",
    COL_PAGES => "crawl.authority.colPages",
    T_RECS => "crawl.authority.tRecs",
    T_BENCH => "crawl.authority.tBench",
    REFERENCE => "crawl.authority.reference",
    PAA_USED => "crawl.authority.paaUsed",
    PAA_MISSING => "crawl.authority.paaMissing",
    CDES_PARTIAL => "crawl.authority.cdesPartial",
}

pub const QUADRANT: &str = "crawl.authority.quadrant";
pub const WARNING: &str = "crawl.authority.warning";
pub const LEVEL: &str = "crawl.authority.level";
pub const DEPTH_PART: &str = "crawl.authority.depthPart";
#[cfg(test)]
pub const DEPTH_PARTS: &[&str] = &["entities", "questions", "gain"];
pub const REC: &str = "crawl.authority.rec";

#[cfg(test)]
pub const QUADRANTS: &[&str] = &[
    "dominant_authority",
    "boutique_specialist",
    "diluted_giant",
    "unfocused_generalist",
];
#[cfg(test)]
pub const WARNINGS: &[&str] = &[
    "empty-authority",
    "template-duplicates",
    "no-dates",
    "no-links",
];
#[cfg(test)]
pub const LEVELS: &[&str] = &["critical", "high", "medium"];

pub const RECS: &[Coded] = &[
    ("fill-gaps", &["pillar", "count"]),
    ("merge-cannibalized", &["count"]),
    ("fix-linking", &["orphans", "bleed"]),
    ("deepen-shallow", &["count"]),
    ("refresh-stale", &["count"]),
];
