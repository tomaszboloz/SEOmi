macro_rules! keys {
    ($($name:ident => $key:literal,)*) => {
        $(pub const $name: &str = $key;)*
        #[cfg(test)]
        pub const ALL: &[&str] = &[$($key),*];
    };
}

keys! {
    TITLE => "crawl.offPage.title",
    INTRO => "crawl.offPage.intro",
    TOPIC => "crawl.offPage.topic",
    SCALE => "crawl.offPage.scale",
    MODEL => "crawl.offPage.model",
    REQUESTED => "crawl.offPage.requested",
    FETCHED => "crawl.offPage.fetched",
    SCORED => "crawl.offPage.scored",
    TBVA => "crawl.offPage.tbva",
    STATUS_LABEL => "crawl.offPage.statusLabel",
    LIMITATIONS_LABEL => "crawl.offPage.limitationsLabel",
    T_SOURCES => "crawl.offPage.tSources",
    SOURCES_INTRO => "crawl.offPage.sourcesIntro",
    AUTHORITY => "crawl.offPage.authority",
    SIMILARITY => "crawl.offPage.similarity",
    CONTRIBUTION => "crawl.offPage.contribution",
    T_CITATIONS => "crawl.offPage.tCitations",
    OFFSET => "crawl.offPage.offset",
    EXCERPT => "crawl.offPage.excerpt",
    DISCLAIMER => "crawl.offPage.disclaimer",
    NA => "crawl.offPage.na",
}

pub const STATUS: &str = "crawl.offPage.status";
pub const LIMITATIONS: &str = "crawl.offPage.limitations";

#[cfg(test)]
pub const STATUSES: &[&str] = &["ready", "partial", "unavailable"];
#[cfg(test)]
pub const LIMITATION_KEYS: &[&str] = &[
    "no-topic-vector",
    "invalid-scale",
    "no-follow-links",
    "source-text-or-authority-missing",
];
