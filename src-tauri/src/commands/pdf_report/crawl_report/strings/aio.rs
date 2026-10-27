//! `pdfReport` label keys of the AI Overviews / RAG readiness section; text lives in locale files.
//! Code-driven texts (band, issue) are looked up as `<prefix>.<engine code>`.

macro_rules! keys {
    ($($name:ident => $key:literal,)*) => {
        $(pub const $name: &str = $key;)*
        /// Every static key of the section, checked against `en.json` in tests.
        #[cfg(test)]
        pub const ALL: &[&str] = &[$($key),*];
    };
}

keys! {
    TITLE => "crawl.aio.title",
    INTRO => "crawl.aio.intro",
    SCORE_TITLE => "crawl.aio.scoreTitle",
    LEGEND => "crawl.aio.legend",
    K_SELF => "crawl.aio.kSelf",
    K_SPO => "crawl.aio.kSpo",
    K_EXTRACT => "crawl.aio.kExtract",
    K_SCORED => "crawl.aio.kScored",
    N_SELF => "crawl.aio.nSelf",
    N_SPO => "crawl.aio.nSpo",
    N_EXTRACT => "crawl.aio.nExtract",
    N_SCORED => "crawl.aio.nScored",
    NOTE_BASIC => "crawl.aio.noteBasic",
    T_PAGES => "crawl.aio.tPages",
    PAGES_INTRO => "crawl.aio.pagesIntro",
    COL_SCORE => "crawl.aio.colScore",
    COL_SELF => "crawl.aio.colSelf",
    COL_SPO => "crawl.aio.colSpo",
    COL_EXTRACT => "crawl.aio.colExtract",
    COL_CHUNKS => "crawl.aio.colChunks",
    T_PASSAGES => "crawl.aio.tPassages",
    PASSAGES_INTRO => "crawl.aio.passagesIntro",
    COL_HEADING => "crawl.aio.colHeading",
    COL_EXCERPT => "crawl.aio.colExcerpt",
    COL_ISSUES => "crawl.aio.colIssues",
    PERCENT => "crawl.aio.percent",
    PROFILE => "crawl.aio.profile",
    PROFILE_STATUS => "crawl.aio.profileStatus",
    PROFILE_STATUS_PERSISTED => "crawl.aio.profileStatusPersisted",
    PROFILE_STATUS_LEGACY => "crawl.aio.profileStatusLegacy",
    PROFILE_STATUS_MISMATCH => "crawl.aio.profileStatusMismatch",
    ALGORITHM_VERSION => "crawl.aio.algorithmVersion",
    CONFIG_HASH => "crawl.aio.configHash",
    LANGUAGE => "crawl.aio.language",
    MARKET => "crawl.aio.market",
    UNKNOWN_REASONS => "crawl.aio.unknownReasons",
    UNKNOWN_DISCLOSURE => "crawl.aio.unknownDisclosure",
}

pub const BAND: &str = "crawl.aio.band";
pub const ISSUE: &str = "crawl.aio.issue";

#[cfg(test)]
pub const BANDS: &[&str] = &["excellent", "good", "moderate", "weak", "critical"];
#[cfg(test)]
pub const ISSUES: &[&str] = &[
    "dangling-pronoun",
    "no-answer-first",
    "filler-opening",
    "no-facts",
    "too-long",
];
