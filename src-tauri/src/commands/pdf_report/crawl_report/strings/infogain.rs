//! `pdfReport` label keys of the Information Gain section; text lives in the locale files.
//! Code-driven texts (band, note, recommendation) are looked up as `<prefix>.<engine code>`;
//! templates use `{{0}}`, `{{1}}` placeholders.

pub use super::focus::Coded;

macro_rules! keys {
    ($($name:ident => $key:literal,)*) => {
        $(pub const $name: &str = $key;)*
        /// Every static key of this section, checked against `en.json` in tests.
        #[cfg(test)]
        pub const ALL: &[&str] = &[$($key),*];
    };
}

keys! {
    TITLE => "crawl.infoGain.title",
    INTRO => "crawl.infoGain.intro",
    SCORE_TITLE => "crawl.infoGain.scoreTitle",
    LEGEND => "crawl.infoGain.legend",
    K_NEFR => "crawl.infoGain.kNefr",
    K_EDSI => "crawl.infoGain.kEdsi",
    K_FHEM => "crawl.infoGain.kFhem",
    K_SDD => "crawl.infoGain.kSdd",
    K_GAIN => "crawl.infoGain.kGain",
    K_ECHO => "crawl.infoGain.kEcho",
    K_DRIFT => "crawl.infoGain.kDrift",
    N_NEFR => "crawl.infoGain.nNefr",
    N_EDSI => "crawl.infoGain.nEdsi",
    N_FHEM => "crawl.infoGain.nFhem",
    N_SDD => "crawl.infoGain.nSdd",
    N_GAIN => "crawl.infoGain.nGain",
    N_ECHO => "crawl.infoGain.nEcho",
    N_DRIFT => "crawl.infoGain.nDrift",
    BASIS => "crawl.infoGain.basis",
    T_PAGES => "crawl.infoGain.tPages",
    PAGES_INTRO => "crawl.infoGain.pagesIntro",
    COL_SCORE => "crawl.infoGain.colScore",
    COL_BAND => "crawl.infoGain.colBand",
    COL_ECHO => "crawl.infoGain.colEcho",
    COL_GAIN => "crawl.infoGain.colGain",
    COL_DRIFT => "crawl.infoGain.colDrift",
    T_RECS => "crawl.infoGain.tRecs",
    RECS_INTRO => "crawl.infoGain.recsIntro",
    COL_NO => "crawl.infoGain.colNo",
    COL_ACTION => "crawl.infoGain.colAction",
}

pub const BAND: &str = "crawl.infoGain.band";
pub const NOTE: &str = "crawl.infoGain.note";
pub const REC: &str = "crawl.infoGain.rec";

#[cfg(test)]
pub const BANDS: &[&str] = &["original", "good", "average", "derivative", "echo"];
#[cfg(test)]
pub const NOTES: &[&str] = &["thinBaseline", "fhemUnavailable", "truncated"];

pub const RECS: &[Coded] = &[
    ("rewrite-echo-sections", &["pages"]),
    ("add-first-hand", &["pages"]),
    ("add-data", &["pages"]),
    ("add-novel-entities", &["pages"]),
    ("fill-consensus", &["pages"]),
    ("remove-drift-sections", &["pages"]),
    ("collect-baseline", &["docs"]),
];
